"""Celery tasks for Earth Engine terrain/infrastructure data ingestion."""

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.processing_job import ProcessingJob
from app.models.terrain import (
    RoadNetwork,
    BuildingFootprint,
    LandCover,
    ElevationTile,
    ParcelTerrainProfile,
)
from app.models.parcel import Parcel
from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from uuid import UUID
from datetime import datetime
from shapely.geometry import shape, Polygon, MultiPolygon
from shapely.ops import unary_union
import json


def _get_bounds_for_district(db, state_code: str, district: str) -> tuple[float, float, float, float] | None:
    """Get bounding box for a district from parcels."""
    result = db.execute(
        select(
            func.min(func.ST_XMin(Parcel.geometry)),
            func.min(func.ST_YMin(Parcel.geometry)),
            func.max(func.ST_XMax(Parcel.geometry)),
            func.max(func.ST_YMax(Parcel.geometry)),
        ).where(
            Parcel.state_code == state_code,
            Parcel.district_code == district,
        )
    ).first()
    if result and all(v is not None for v in result):
        return result  # min_lng, min_lat, max_lng, max_lat
    return None


def _get_all_districts(db) -> list[tuple[str, str]]:
    """Get all unique state/district combinations from parcels."""
    result = db.execute(
        select(Parcel.state_code, Parcel.district_code)
        .distinct()
        .where(Parcel.state_code.isnot(None), Parcel.district_code.isnot(None))
    ).all()
    return [(row[0], row[1]) for row in result]


def _store_terrain_features(db, terrain, state_code: str, district: str, year: int) -> dict:
    """Store terrain features in batch. Returns counts."""
    # Store roads
    roads_inserted = 0
    for road in terrain.roads.data:
        if road.geometry.get("type") != "LineString":
            continue
        coords = road.geometry.get("coordinates", [])
        if len(coords) < 2:
            continue
        stmt = pg_insert(RoadNetwork).values(
            name=road.name or f"road_{roads_inserted}",
            road_type=road.road_type,
            state_code=state_code,
            district=district,
            geometry=func.ST_GeomFromGeoJSON(json.dumps(road.geometry)),
            source=terrain.roads.source,
            osm_tags=road.osm_tags,
        ).on_conflict_do_nothing()
        db.execute(stmt)
        roads_inserted += 1

    # Store buildings
    buildings_inserted = 0
    for building in terrain.buildings.data:
        if building.geometry.get("type") != "Polygon":
            continue
        stmt = pg_insert(BuildingFootprint).values(
            building_type=building.building_type,
            height_m=building.height_m,
            confidence=building.confidence,
            state_code=state_code,
            district=district,
            geometry=func.ST_GeomFromGeoJSON(json.dumps(building.geometry)),
            source=terrain.buildings.source,
        ).on_conflict_do_nothing()
        db.execute(stmt)
        buildings_inserted += 1

    # Store land cover - now stores stats not polygons
    landcover_inserted = 0
    for lc in terrain.landcover.data:
        stmt = pg_insert(LandCover).values(
            class_code=lc.class_code,
            class_name=lc.class_name,
            year=year,
            state_code=state_code,
            district=district,
            geometry=func.ST_MakeEnvelope(
                -180, -90, 180, 90, 4326  # placeholder - we store stats, not polygons
            ),
            source=terrain.landcover.source,
        ).on_conflict_do_nothing()
        db.execute(stmt)
        landcover_inserted += 1

    # Store elevation tile
    elev = terrain.elevation.data
    if not elev or not hasattr(elev, 'min_elevation_m'):
        # Elevation fetch failed - store defaults
        elev_values = {
            "min_elevation_m": 0.0,
            "max_elevation_m": 0.0,
            "mean_elevation_m": 0.0,
            "mean_slope_deg": 0.0,
            "max_slope_deg": 0.0,
            "slope_histogram": {},
        }
    else:
        elev_values = {
            "min_elevation_m": elev.min_elevation_m,
            "max_elevation_m": elev.max_elevation_m,
            "mean_elevation_m": elev.mean_elevation_m,
            "mean_slope_deg": elev.mean_slope_deg,
            "max_slope_deg": elev.max_slope_deg,
            "slope_histogram": elev.slope_histogram,
        }
    
    stmt = pg_insert(ElevationTile).values(
        **elev_values,
        state_code=state_code,
        district=district,
        geometry=func.ST_MakeEnvelope(0, 0, 0, 0, 4326),
        source=terrain.elevation.source,
    ).on_conflict_do_nothing(index_elements=["state_code", "district"])
    db.execute(stmt)

    return {
        "roads": roads_inserted,
        "buildings": buildings_inserted,
        "landcover": landcover_inserted,
        "elevation": "computed",
    }


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def ingest_district_terrain(self, job_id: str, state_code: str, district: str, year: int = 2026):
    """Ingest all terrain data for a district.
    
    Fetches roads, buildings, land cover, and elevation from Earth Engine
    and stores in PostGIS tables.
    """
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        job.progress = 0
        job.dataset_status = {}
        db.commit()

        bounds = _get_bounds_for_district(db, state_code, district)
        if not bounds:
            raise ValueError(f"No parcels found for {state_code}/{district}")

        min_lng, min_lat, max_lng, max_lat = bounds
        from app.services.image_diff import GeoBounds
        gee_bounds = GeoBounds(min_lng=min_lng, min_lat=min_lat, max_lng=max_lng, max_lat=max_lat)

        job.progress = 10
        db.commit()

        # Import EE terrain service
        from app.services.earth_engine_terrain import fetch_terrain_bundle

        terrain = fetch_terrain_bundle(gee_bounds, year, job_id)

        job.progress = 50
        # Record dataset status
        job.dataset_status = {
            "roads": {"status": "completed" if not terrain.roads.error else "failed", "source": terrain.roads.dataset_id, "features": terrain.roads.feature_count, "eecu": terrain.roads.estimated_eecu, "fallback": terrain.roads.fallback_used, "error": terrain.roads.error},
            "buildings": {"status": "completed" if not terrain.buildings.error else "failed", "source": terrain.buildings.dataset_id, "features": terrain.buildings.feature_count, "eecu": terrain.buildings.estimated_eecu, "fallback": terrain.buildings.fallback_used, "error": terrain.buildings.error},
            "landcover": {"status": "completed" if not terrain.landcover.error else "failed", "source": terrain.landcover.dataset_id, "features": terrain.landcover.feature_count, "eecu": terrain.landcover.estimated_eecu, "fallback": terrain.landcover.fallback_used, "error": terrain.landcover.error},
            "elevation": {"status": "completed" if not terrain.elevation.error else "failed", "source": terrain.elevation.dataset_id, "features": 1, "eecu": terrain.elevation.estimated_eecu, "fallback": terrain.elevation.fallback_used, "error": terrain.elevation.error},
        }
        job.total_estimated_eecu = sum(
            d.get("eecu", 0) for d in job.dataset_status.values() if isinstance(d, dict)
        )
        db.commit()

        # Store features
        counts = _store_terrain_features(db, terrain, state_code, district, year)
        db.commit()

        job.progress = 90
        db.commit()

        # Trigger parcel profile computation
        compute_parcel_profiles.delay(job_id, state_code, district, year)

        job.status = "succeeded"
        job.result = counts
        job.completed_at = func.now()
        job.progress = 100
        db.commit()

        return job.result

    except Exception as exc:
        db.rollback()
        job = db.query(ProcessingJob).get(UUID(job_id))
        if job:
            job.status = "failed"
            job.error = str(exc)
            job.completed_at = func.now()
            db.commit()
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def ingest_state_terrain(self, job_id: str, state_code: str, year: int = 2026):
    """Ingest terrain data for all districts in a state.
    
    Creates a parent job and spawns child jobs per district.
    """
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        districts = _get_all_districts(db)
        state_districts = [(s, d) for s, d in districts if s == state_code]

        if not state_districts:
            raise ValueError(f"No districts found for state {state_code}")

        job.progress = 5
        job.result = {"total_districts": len(state_districts), "completed": 0}
        db.commit()

        for idx, (s, d) in enumerate(state_districts):
            # Create child job for each district
            child_job = ProcessingJob(
                job_type="ingest_district_terrain",
                status="pending",
                payload={"state_code": s, "district": d, "year": year},
            )
            db.add(child_job)
            db.commit()

            # Queue the district task
            ingest_district_terrain.delay(str(child_job.id), s, d, year)

            job.progress = 5 + int((idx + 1) / len(state_districts) * 85)
            job.result["completed"] = idx + 1
            db.commit()

        job.status = "succeeded"
        job.completed_at = func.now()
        job.progress = 100
        db.commit()

        return {"state": state_code, "districts_queued": len(state_districts)}

    except Exception as exc:
        db.rollback()
        job = db.query(ProcessingJob).get(UUID(job_id))
        if job:
            job.status = "failed"
            job.error = str(exc)
            job.completed_at = func.now()
            db.commit()
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def compute_parcel_profiles(self, job_id: str, state_code: str, district: str, year: int = 2026):
    """Compute terrain profiles for all parcels in a district using BATCH spatial queries.
    
    Uses a single optimized query with lateral joins to compute all profiles at once,
    avoiding N+1 query problem.
    """
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        job.progress = 0
        db.commit()

        # Single batch query computing all parcel profiles at once
        batch_query = text("""
            WITH parcel_data AS (
                SELECT 
                    p.id as parcel_id,
                    p.geometry,
                    ST_Area(p.geometry)::numeric / 10000 as area_ha
                FROM parcels p
                WHERE p.state_code = :state_code
                  AND p.district_code = :district
            ),
            elevation_stats AS (
                SELECT 
                    pd.parcel_id,
                    AVG(et.mean_elevation_m) as mean_elev,
                    MIN(et.min_elevation_m) as min_elev,
                    MAX(et.max_elevation_m) as max_elev,
                    AVG(et.mean_slope_deg) as mean_slope,
                    MAX(et.max_slope_deg) as max_slope
                FROM parcel_data pd
                LEFT JOIN elevation_tiles et
                    ON ST_Intersects(et.geometry, pd.geometry)
                WHERE et.state_code = :state_code
                  AND et.district = :district
                GROUP BY pd.parcel_id
            ),
            landcover_stats AS (
                SELECT 
                    pd.parcel_id,
                    lc.class_name,
                    SUM(ST_Area(ST_Intersection(lc.geometry, pd.geometry))::numeric / ST_Area(pd.geometry)::numeric * 100) as pct
                FROM parcel_data pd
                LEFT JOIN land_cover lc
                    ON ST_Intersects(lc.geometry, pd.geometry)
                    AND lc.year = :year
                WHERE lc.state_code = :state_code
                  AND lc.district = :district
                GROUP BY pd.parcel_id, lc.class_name
            ),
            road_stats AS (
                SELECT DISTINCT ON (pd.parcel_id)
                    pd.parcel_id,
                    ST_Distance(rn.geometry, pd.geometry) as dist,
                    rn.road_type
                FROM parcel_data pd
                LEFT JOIN road_networks rn
                    ON ST_DWithin(rn.geometry, pd.geometry, 5000)
                WHERE rn.state_code = :state_code
                  AND rn.district = :district
                ORDER BY pd.parcel_id, ST_Distance(rn.geometry, pd.geometry)
            ),
            building_stats AS (
                SELECT 
                    pd.parcel_id,
                    COUNT(bf.id) as count,
                    SUM(ST_Area(ST_Intersection(bf.geometry, pd.geometry))::numeric / ST_Area(pd.geometry)::numeric * 100) as coverage_pct
                FROM parcel_data pd
                LEFT JOIN building_footprints bf
                    ON ST_Intersects(bf.geometry, pd.geometry)
                WHERE bf.state_code = :state_code
                  AND bf.district = :district
                GROUP BY pd.parcel_id
            ),
            combined AS (
                SELECT
                    pd.parcel_id,
                    pd.area_ha,
                    COALESCE(es.mean_elev, 0) as mean_elev,
                    COALESCE(es.min_elev, 0) as min_elev,
                    COALESCE(es.max_elev, 0) as max_elev,
                    COALESCE(es.mean_slope, 0) as mean_slope,
                    COALESCE(es.max_slope, 0) as max_slope,
                    COALESCE(json_object_agg(lcs.class_name, lcs.pct) FILTER (WHERE lcs.class_name IS NOT NULL), '{}'::json) as land_cover_mix,
                    COALESCE(rs.dist, 9999) as nearest_road_dist,
                    rs.road_type as nearest_road_type,
                    COALESCE(bs.count, 0) as building_count,
                    COALESCE(bs.coverage_pct, 0) as building_coverage
                FROM parcel_data pd
                LEFT JOIN elevation_stats es ON pd.parcel_id = es.parcel_id
                LEFT JOIN landcover_stats lcs ON pd.parcel_id = lcs.parcel_id
                LEFT JOIN road_stats rs ON pd.parcel_id = rs.parcel_id
                LEFT JOIN building_stats bs ON pd.parcel_id = bs.parcel_id
                GROUP BY pd.parcel_id, pd.area_ha, es.mean_elev, es.min_elev, es.max_elev, 
                         es.mean_slope, es.max_slope, rs.dist, rs.road_type, bs.count, bs.coverage_pct
            )
            SELECT * FROM combined
        """)

        result = db.execute(batch_query, {
            "state_code": state_code,
            "district": district,
            "year": year
        }).all()

        if not result:
            raise ValueError(f"No parcels found for {state_code}/{district}")

        total = len(result)
        profiles_computed = 0

        # Determine actual sources from the terrain ingestion job
        parent_job = db.query(ProcessingJob).filter(
            ProcessingJob.job_type == "ingest_district_terrain",
            ProcessingJob.payload.op('->>')('state_code') == state_code,
            ProcessingJob.payload.op('->>')('district') == district,
            ProcessingJob.status == "succeeded"
        ).order_by(ProcessingJob.completed_at.desc()).first()

        sources = {
            "elevation": "COPERNICUS_DEM_30M",
            "roads": "OSM",
            "buildings": "MS_BUILDINGS",
            "landcover": "DYNAMIC_WORLD_2026",
        }
        if parent_job and parent_job.dataset_status:
            ds = parent_job.dataset_status
            if ds.get("roads", {}).get("fallback"):
                sources["roads"] = ds["roads"].get("source", "OSM_FALLBACK")
            if ds.get("buildings", {}).get("fallback"):
                sources["buildings"] = ds["buildings"].get("source", "MS_BUILDINGS_FALLBACK")
            if ds.get("landcover", {}).get("fallback"):
                sources["landcover"] = ds["landcover"].get("source", "DYNAMIC_WORLD_FALLBACK")
            if ds.get("elevation", {}).get("fallback"):
                sources["elevation"] = ds["elevation"].get("source", "COPERNICUS_DEM_30M_FALLBACK")

        batch_size = 500
        for i in range(0, total, batch_size):
            batch = result[i:i + batch_size]
            
            profiles = []
            for row in batch:
                land_cover_mix = row.land_cover_mix or {}
                dominant_lc = max(land_cover_mix.items(), key=lambda x: x[1])[0] if land_cover_mix else "Unknown"
                
                nearest_road_dist = float(row.nearest_road_dist) if row.nearest_road_dist else 9999
                road_access_score = 1.0 if nearest_road_dist < 100 else (0.5 if nearest_road_dist < 1000 else 0.1)
                
                building_count = row.building_count or 0
                building_coverage = float(row.building_coverage or 0)
                parcel_area_ha = float(row.area_ha or 1)
                building_density = building_count / parcel_area_ha if parcel_area_ha > 0 else 0
                
                mean_elev = float(row.mean_elev or 0)
                min_elev = float(row.min_elev or 0)
                max_elev = float(row.max_elev or 0)
                mean_slope = float(row.mean_slope or 0)
                max_slope = float(row.max_slope or 0)
                
                constraints = {
                    "water_body": "Water" in land_cover_mix,
                    "wetland": "Wetland" in land_cover_mix,
                    "steep_slope": max_slope > 15,
                    "protected_area": False,
                    "flood_zone": min_elev < 5,
                    "building_footprint": building_count > 0,
                }
                flood_risk = 0.8 if constraints["flood_zone"] else (0.3 if constraints["water_body"] else 0.1)

                profile = ParcelTerrainProfile(
                    parcel_id=row.parcel_id,
                    mean_elevation_m=mean_elev,
                    min_elevation_m=min_elev,
                    max_elevation_m=max_elev,
                    elevation_range_m=max_elev - min_elev,
                    mean_slope_deg=mean_slope,
                    max_slope_deg=max_slope,
                    steep_slope_percentage=100.0 if max_slope > 15 else 0.0,
                    dominant_land_cover=dominant_lc,
                    land_cover_mix=land_cover_mix,
                    nearest_road_distance_m=nearest_road_dist,
                    nearest_road_type=row.nearest_road_type,
                    road_access_score=road_access_score,
                    building_count=building_count,
                    building_coverage_percentage=building_coverage,
                    building_density_per_ha=building_density,
                    flood_risk_score=flood_risk,
                    constraints=constraints,
                )
                profiles.append(profile)
            
            # Bulk upsert
            for profile in profiles:
                db.merge(profile)
            
            profiles_computed += len(profiles)
            job.progress = int(profiles_computed / total * 100)
            db.commit()

        job.status = "succeeded"
        job.result = {"profiles_computed": profiles_computed}
        job.completed_at = func.now()
        job.progress = 100
        db.commit()

        return job.result

    except Exception as exc:
        db.rollback()
        job = db.query(ProcessingJob).get(UUID(job_id))
        if job:
            job.status = "failed"
            job.error = str(exc)
            job.completed_at = func.now()
            db.commit()
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=1, default_retry_delay=300)
def refresh_all_terrain_profiles(self, job_id: str):
    """Refresh terrain profiles for all parcels (after new terrain data ingestion)."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        districts = _get_all_districts(db)
        
        for idx, (state_code, district) in enumerate(districts):
            compute_parcel_profiles.delay(f"refresh_{state_code}_{district}", state_code, district)
            job.progress = int((idx + 1) / len(districts) * 100)
            db.commit()

        job.status = "succeeded"
        job.completed_at = func.now()
        job.progress = 100
        db.commit()

        return {"districts_queued": len(districts)}

    except Exception as exc:
        db.rollback()
        job = db.query(ProcessingJob).get(UUID(job_id))
        if job:
            job.status = "failed"
            job.error = str(exc)
            job.completed_at = func.now()
            db.commit()
        raise self.retry(exc=exc)
    finally:
        db.close()