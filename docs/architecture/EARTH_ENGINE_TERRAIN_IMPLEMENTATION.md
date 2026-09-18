# Earth Engine Terrain/Infrastructure Data Implementation

## Overview
Fetch and store environmental/terrain data from Google Earth Engine to enhance parcel generation constraints and analytics.

## New Database Models

### 1. Road Networks (from OSM via EE)
```python
# app/models/terrain.py
class RoadNetwork(Base):
    __tablename__ = "road_networks"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    road_type: Mapped[str] = mapped_column(String(30))  # HIGHWAY|PRIMARY|SECONDARY|TERTIARY|RESIDENTIAL|TRACK
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="LINESTRING", srid=4326, spatial_index=True))
    source: Mapped[str] = mapped_column(String(30))  # OSM|GOOGLE_ROADS|SURVEY
    osm_tags: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

### 2. Building Footprints (Microsoft/Google Open Buildings)
```python
class BuildingFootprint(Base):
    __tablename__ = "building_footprints"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_type: Mapped[str] = mapped_column(String(30))  # RESIDENTIAL|COMMERCIAL|INDUSTRIAL|AGRICULTURAL|UNKNOWN
    height_m: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    confidence: Mapped[float] = mapped_column(Numeric(3, 2))  # 0-1
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True))
    source: Mapped[str] = mapped_column(String(30))  # OSM|MS_BUILDINGS|GOOGLE_OPEN_BUILDINGS
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

### 3. Land Cover (ESA WorldCover / Dynamic World)
```python
class LandCover(Base):
    __tablename__ = "land_cover"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_code: Mapped[int] = mapped_column(Integer, index=True)  # ESA: 10=Tree,20=Shrub,30=Grass,40=Crop,50=Built,60=Water,70=Wetland,80=Moss,90=Bare,95=Snow
    class_name: Mapped[str] = mapped_column(String(50))
    year: Mapped[int] = mapped_column(Integer, index=True)
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True))
    source: Mapped[str] = mapped_column(String(30))  # ESA_WORLDCOVER|DYNAMIC_WORLD|SENTINEL2_CLASSIFIED
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

### 4. Elevation Tiles (COPERNICUS DEM 30m)
```python
class ElevationTile(Base):
    __tablename__ = "elevation_tiles"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    min_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    max_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    mean_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    mean_slope_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    max_slope_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True))
    source: Mapped[str] = mapped_column(String(30))  # COPERNICUS_DEM_30M|SRTM30|NASADEM
    ee_asset_id: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
```

### 5. Parcel-Level Materialized Profile
```python
class ParcelTerrainProfile(Base):
    __tablename__ = "parcel_terrain_profiles"
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parcels.id", ondelete="CASCADE"), unique=True, index=True)
    mean_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    mean_slope_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    max_slope_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    dominant_land_cover: Mapped[str] = mapped_column(String(50))
    land_cover_mix: Mapped[dict] = mapped_column(JSON)  # {class_name: percentage}
    nearest_road_distance_m: Mapped[float] = mapped_column(Numeric(10, 2))
    nearest_road_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    building_count: Mapped[int] = mapped_column(Integer, default=0)
    building_density_per_ha: Mapped[float] = mapped_column(Numeric(6, 2))
    flood_risk_score: Mapped[float] = mapped_column(Numeric(3, 2))  # 0-1
    constraints: Mapped[dict] = mapped_column(JSON)  # {"steep_slope": bool, "water_body": bool, "protected_area": bool, "flood_zone": bool}
    computed_at: Mapped[datetime] = mapped_column(server_default=func.now())
    sources: Mapped[dict] = mapped_column(JSON)  # {"elevation": "COPERNICUS_DEM_30M", "roads": "OSM", "buildings": "MS_BUILDINGS", "landcover": "ESA_WORLDCOVER_2023"}
```

## Earth Engine Service Extensions

### app/services/earth_engine_terrain.py
```python
"""Extended Earth Engine service for terrain/infrastructure data fetching."""

import ee
from dataclasses import dataclass
from typing import list, dict
from app.config import get_settings
from app.services.image_diff import GeoBounds

@dataclass
class RoadFeature:
    geometry: dict  # GeoJSON LineString
    road_type: str
    name: str | None
    osm_tags: dict

@dataclass
class BuildingFeature:
    geometry: dict  # GeoJSON Polygon
    building_type: str
    height_m: float | None
    confidence: float

@dataclass
class ElevationProfile:
    min_elevation_m: float
    max_elevation_m: float
    mean_elevation_m: float
    mean_slope_deg: float
    max_slope_deg: float
    slope_histogram: dict  # {slope_range: percentage}

def fetch_road_network(bounds: GeoBounds) -> list[RoadFeature]:
    """Fetch OSM roads from EE's OSM dataset."""
    _ensure_initialized()
    region = ee.Geometry.Rectangle([bounds.min_lng, bounds.min_lat, bounds.max_lng, bounds.max_lat])
    
    # EE's OSM roads: projects/sat-io/open-datasets/OSM/roads
    roads = ee.FeatureCollection("projects/sat-io/open-datasets/OSM/roads").filterBounds(region)
    
    def extract_props(f):
        return ee.Feature(None, {
            "geometry": f.geometry(),
            "road_type": f.get("highway"),
            "name": f.get("name"),
            "osm_tags": f.toDictionary()
        })
    
    features = roads.map(extract_props).getInfo()["features"]
    return [RoadFeature(**f["properties"]) for f in features]

def fetch_building_footprints(bounds: GeoBounds) -> list[BuildingFeature]:
    """Fetch Microsoft Building Footprints or Google Open Buildings."""
    _ensure_initialized()
    region = ee.Geometry.Rectangle([bounds.min_lng, bounds.min_lat, bounds.max_lng, bounds.max_lat])
    
    # Microsoft Building Footprints
    buildings = ee.FeatureCollection("projects/sat-io/open-datasets/MSBuildings/Global").filterBounds(region)
    
    def extract_props(f):
        return ee.Feature(None, {
            "geometry": f.geometry(),
            "confidence": f.get("confidence"),
            "height": f.get("height")
        })
    
    features = buildings.map(extract_props).getInfo()["features"]
    return [BuildingFeature(
        geometry=f["properties"]["geometry"],
        building_type="UNKNOWN",
        height_m=f["properties"].get("height"),
        confidence=f["properties"].get("confidence", 0.5)
    ) for f in features]

def fetch_land_cover(bounds: GeoBounds, year: int = 2023) -> list[dict]:
    """Fetch ESA WorldCover land cover classification."""
    _ensure_initialized()
    region = ee.Geometry.Rectangle([bounds.min_lng, bounds.min_lat, bounds.max_lng, bounds.max_lat])
    
    # ESA WorldCover 2021 (or Dynamic World for annual)
    lc = ee.ImageCollection("ESA/WorldCover/v200").first().clip(region)
    
    # Reduce to polygons
    vectors = lc.reduceToVectors(
        geometry=region,
        scale=10,
        geometryType="polygon",
        eightConnected=False,
        labelProperty="Map",
        maxPixels=1e10
    )
    
    features = vectors.getInfo()["features"]
    return [{
        "geometry": f["geometry"],
        "class_code": f["properties"]["Map"],
        "class_name": _esa_class_name(f["properties"]["Map"])
    } for f in features]

def fetch_elevation_profile(bounds: GeoBounds) -> ElevationProfile:
    """Fetch COPERNICUS DEM 30m and compute stats."""
    _ensure_initialized()
    region = ee.Geometry.Rectangle([bounds.min_lng, bounds.min_lat, bounds.max_lng, bounds.max_lat])
    
    dem = ee.Image("COPERNICUS/DEM/GLO30").clip(region)
    slope = ee.Terrain.slope(dem)
    
    # Stats
    elev_stats = dem.reduceRegion(
        reducer=ee.Reducer.minMax().combine(ee.Reducer.mean(), "", True).combine(ee.Reducer.histogram(20, 0, 5000), "", True),
        geometry=region,
        scale=30,
        maxPixels=1e10
    ).getInfo()
    
    slope_stats = slope.reduceRegion(
        reducer=ee.Reducer.minMax().combine(ee.Reducer.mean(), "", True).combine(ee.Reducer.histogram(20, 0, 60), "", True),
        geometry=region,
        scale=30,
        maxPixels=1e10
    ).getInfo()
    
    return ElevationProfile(
        min_elevation_m=elev_stats.get("elevation_min", 0),
        max_elevation_m=elev_stats.get("elevation_max", 0),
        mean_elevation_m=elev_stats.get("elevation_mean", 0),
        mean_slope_deg=slope_stats.get("slope_mean", 0),
        max_slope_deg=slope_stats.get("slope_max", 0),
        slope_histogram=slope_stats.get("slope_histogram", {})
    )

def _esa_class_name(code: int) -> str:
    mapping = {
        10: "Tree cover", 20: "Shrubland", 30: "Grassland", 40: "Cropland",
        50: "Built-up", 60: "Water", 70: "Wetland", 80: "Moss/lichen",
        90: "Bare/sparse vegetation", 95: "Snow/ice"
    }
    return mapping.get(code, f"Unknown({code})")
```

## Celery Tasks

### app/tasks/terrain_tasks.py
```python
"""Celery tasks for batch terrain data ingestion."""

from celery import shared_task
from app.services.earth_engine_terrain import (
    fetch_road_network, fetch_building_footprints, 
    fetch_land_cover, fetch_elevation_profile
)
from app.services.parcels_service import get_cluster_bounds
from app.models.terrain import (
    RoadNetwork, BuildingFootprint, LandCover, 
    ElevationTile, ParcelTerrainProfile
)
from app.database import SessionLocal
from geoalchemy2.shape import from_shape
from shapely.geometry import shape
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3, queue="earth_engine")
def ingest_cluster_terrain(self, cluster_id: str):
    """Fetch all terrain data for a cluster and materialize parcel profiles."""
    db = SessionLocal()
    try:
        bounds = get_cluster_bounds(db, cluster_id)
        if not bounds:
            logger.warning(f"No bounds for cluster {cluster_id}")
            return
        
        # Fetch all data
        logger.info(f"Fetching roads for {cluster_id}")
        roads = fetch_road_network(bounds)
        _store_roads(db, cluster_id, roads)
        
        logger.info(f"Fetching buildings for {cluster_id}")
        buildings = fetch_building_footprints(bounds)
        _store_buildings(db, cluster_id, buildings)
        
        logger.info(f"Fetching land cover for {cluster_id}")
        landcover = fetch_land_cover(bounds)
        _store_landcover(db, cluster_id, landcover)
        
        logger.info(f"Fetching elevation for {cluster_id}")
        elevation = fetch_elevation_profile(bounds)
        _store_elevation(db, cluster_id, elevation)
        
        logger.info(f"Materializing parcel profiles for {cluster_id}")
        _materialize_parcel_profiles(db, cluster_id, bounds)
        
        db.commit()
        logger.info(f"Completed terrain ingestion for {cluster_id}")
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed terrain ingestion for {cluster_id}: {e}")
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()

def _store_roads(db, cluster_id, roads):
    for r in roads:
        geom = from_shape(shape(r.geometry), srid=4326)
        db.add(RoadNetwork(
            name=r.name or f"Road_{cluster_id}",
            road_type=r.road_type or "UNKNOWN",
            state_code=cluster_id.split("-")[0],
            district=cluster_id,
            geometry=geom,
            source="OSM",
            osm_tags=r.osm_tags
        ))

def _store_buildings(db, cluster_id, buildings):
    for b in buildings:
        geom = from_shape(shape(b.geometry), srid=4326)
        db.add(BuildingFootprint(
            building_type=b.building_type,
            height_m=b.height_m,
            confidence=b.confidence,
            state_code=cluster_id.split("-")[0],
            district=cluster_id,
            geometry=geom,
            source="MS_BUILDINGS"
        ))

def _store_landcover(db, cluster_id, landcover):
    for lc in landcover:
        geom = from_shape(shape(lc["geometry"]), srid=4326)
        db.add(LandCover(
            class_code=lc["class_code"],
            class_name=lc["class_name"],
            year=2023,
            state_code=cluster_id.split("-")[0],
            district=cluster_id,
            geometry=geom,
            source="ESA_WORLDCOVER"
        ))

def _store_elevation(db, cluster_id, elevation):
    # Store as tile covering the cluster bounds
    db.add(ElevationTile(
        min_elevation_m=elevation.min_elevation_m,
        max_elevation_m=elevation.max_elevation_m,
        mean_elevation_m=elevation.mean_elevation_m,
        mean_slope_deg=elevation.mean_slope_deg,
        max_slope_deg=elevation.max_slope_deg,
        state_code=cluster_id.split("-")[0],
        district=cluster_id,
        geometry=from_shape(shape(bounds.to_polygon()), srid=4326),
        source="COPERNICUS_DEM_30M"
    ))

def _materialize_parcel_profiles(db, cluster_id, bounds):
    """Compute ParcelTerrainProfile for each parcel in cluster using PostGIS."""
    from sqlalchemy import text
    
    # This runs as raw SQL for performance - uses spatial joins
    sql = text("""
        INSERT INTO parcel_terrain_profiles (
            parcel_id, mean_elevation_m, mean_slope_deg, max_slope_deg,
            dominant_land_cover, land_cover_mix, nearest_road_distance_m,
            nearest_road_type, building_count, building_density_per_ha,
            flood_risk_score, constraints, computed_at, sources
        )
        SELECT 
            p.id,
            ST_Z(ST_Centroid(ST_Intersection(p.geometry, et.geometry))) as mean_elev,  -- simplified
            -- ... full PostGIS spatial queries here
        FROM parcels p
        CROSS JOIN elevation_tiles et
        WHERE p.cluster_id = :cluster_id
        ON CONFLICT (parcel_id) DO UPDATE SET ...
    """)
    db.execute(sql, {"cluster_id": cluster_id})
```

## Cost Analysis (Recommended Solution)

### One-Time Batch Ingestion (All 3840 parcels, ~60 clusters)

| Operation | Clusters | EECU per Cluster | Total EECU |
|-----------|----------|------------------|------------|
| Road Network (OSM) | 60 | 0.15 | 9.0 |
| Building Footprints (MS) | 60 | 0.30 | 18.0 |
| Land Cover (ESA WorldCover) | 60 | 0.15 | 9.0 |
| Elevation/Slope (COPERNICUS DEM) | 60 | 0.20 | 12.0 |
| **Total One-Time** | | | **~48 EECU** |

### Monthly Operational (On-Demand Only)

| Operation | Frequency | EECU per Call | Monthly EECU |
|-----------|-----------|---------------|--------------|
| NDVI/True-color (officer requests) | 500/month | 0.10 | 50.0 |
| Change Detection (officer requests) | 50/month | 1.0 | 50.0 |
| **Total Monthly** | | | **~100 EECU** |

### **Grand Total: ~148 EECU/month** (within 150 free tier)

### If Exceeds Free Tier
- Paid tier: ~$0.05-0.10/EECU-hour
- At 200 EECU/month: **$10-20/month**
- At 500 EECU/month: **$25-50/month**

## Implementation Checklist

- [ ] Create `app/models/terrain.py` with 5 new models
- [ ] Create `app/services/earth_engine_terrain.py` with 4 fetch functions
- [ ] Create `app/tasks/terrain_tasks.py` with batch ingestion task
- [ ] Add Alembic migration for new tables + GIST indexes
- [ ] Register `earth_engine` queue in `celery_app.py` (already done)
- [ ] Add CLI command: `python -m scripts.ingest_terrain --all-clusters`
- [ ] Add monitoring endpoint: `GET /api/v1/admin/terrain/status`
- [ ] Update parcel generation to read `ParcelTerrainProfile.constraints`

## Usage in Parcel Generation

```python
# In cluster_generator.py or seed.py
def _apply_terrain_constraints(config: ClusterGeometryConfig, parcels: list[GeneratedParcel]) -> list[GeneratedParcel]:
    db = SessionLocal()
    try:
        profiles = db.query(ParcelTerrainProfile).join(Parcel).filter(
            Parcel.cluster_id == config.cluster_id
        ).all()
        
        profile_map = {p.parcel_id: p for p in profiles}
        
        filtered = []
        for gp in parcels:
            # Find matching parcel (by centroid proximity)
            # Apply constraints
            constraints = profile_map.get(parcel_id, {}).constraints
            if constraints.get("water_body") or constraints.get("steep_slope") or constraints.get("protected_area"):
                continue  # Skip this parcel location
            if constraints.get("flood_zone"):
                # Reduce parcel size or mark as restricted
                pass
            filtered.append(gp)
        
        return filtered
    finally:
        db.close()
```

## Monitoring & Alerting

```python
# Add to admin dashboard
@app.get("/api/v1/admin/terrain/usage")
def get_ee_usage():
    """Query GEE Cloud Monitoring API for current month usage."""
    # Or track locally via task logs
    return {
        "monthly_eecu_estimate": 148,
        "free_tier_limit": 150,
        "remaining": 2,
        "last_ingestion": "2026-09-17T10:30:00Z",
        "clusters_completed": 58,
        "clusters_total": 60
    }
```