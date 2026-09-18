"""Admin API endpoints for Earth Engine terrain data monitoring."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from datetime import datetime, timedelta

from app.auth.deps import require_roles
from app.database import get_db
from app.models.user import User
from app.models.terrain import (
    RoadNetwork,
    BuildingFootprint,
    LandCover,
    ElevationTile,
    ParcelTerrainProfile,
)
from app.models.parcel import Parcel
from app.models.processing_job import ProcessingJob
from app.services.eecu_tracker import format_eecu_report


router = APIRouter(prefix="/admin/terrain", tags=["admin-terrain"])


@router.get("/status")
def get_terrain_status(db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    """Get Earth Engine terrain ingestion status and usage stats."""
    # Count records in each terrain table
    roads_count = db.query(func.count(RoadNetwork.id)).scalar()
    buildings_count = db.query(func.count(BuildingFootprint.id)).scalar()
    landcover_count = db.query(func.count(LandCover.id)).scalar()
    elevation_count = db.query(func.count(ElevationTile.id)).scalar()
    profiles_count = db.query(func.count(ParcelTerrainProfile.id)).scalar()
    parcels_total = db.query(func.count(Parcel.id)).scalar()

    # Coverage percentage
    coverage_pct = round((profiles_count / parcels_total * 100) if parcels_total > 0 else 0, 1)

    # District breakdown
    district_stats = db.execute(
        select(
            Parcel.state_code,
            Parcel.district_code,
            func.count(Parcel.id).label("total_parcels"),
            func.count(ParcelTerrainProfile.id).label("profiled_parcels"),
        )
        .outerjoin(ParcelTerrainProfile, Parcel.id == ParcelTerrainProfile.parcel_id)
        .group_by(Parcel.state_code, Parcel.district_code)
        .order_by(Parcel.state_code, Parcel.district_code)
    ).all()

    districts = [
        {
            "state_code": row.state_code,
            "district": row.district_code,
            "total_parcels": row.total_parcels,
            "profiled_parcels": row.profiled_parcels,
            "coverage_pct": round((row.profiled_parcels / row.total_parcels * 100) if row.total_parcels > 0 else 0, 1),
        }
        for row in district_stats
    ]

    # Recent terrain ingestion jobs
    recent_jobs = db.execute(
        select(ProcessingJob)
        .where(ProcessingJob.job_type.in_(["ingest_district_terrain", "ingest_state_terrain", "compute_parcel_profiles"]))
        .order_by(ProcessingJob.created_at.desc())
        .limit(20)
    ).scalars().all()

    jobs = []
    total_actual_eecu = 0.0
    for job in recent_jobs:
        job_data = {
            "id": str(job.id),
            "job_type": job.job_type,
            "status": job.status,
            "payload": job.payload,
            "result": job.result,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error": job.error,
        }
        
        # Include EECU tracking data
        if job.dataset_status:
            job_data["dataset_status"] = job.dataset_status
            job_data["total_estimated_eecu"] = float(job.total_estimated_eecu or 0)
            job_data["total_actual_eecu"] = float(job.actual_eecu or 0)
            total_actual_eecu += float(job.actual_eecu or 0)
        
        jobs.append(job_data)

    # EECU estimation from actual tracked data
    actual_eecu_by_dataset = {}
    estimated_eecu_by_dataset = {}
    
    # Aggregate from recent jobs
    for job in recent_jobs:
        if job.dataset_status:
            for dataset, stats in job.dataset_status.items():
                if isinstance(stats, dict):
                    actual_eecu_by_dataset[dataset] = actual_eecu_by_dataset.get(dataset, 0) + stats.get("total_actual_eecu", 0)
                    estimated_eecu_by_dataset[dataset] = estimated_eecu_by_dataset.get(dataset, 0) + stats.get("total_estimated_eecu", 0)
    
    total_estimated = sum(estimated_eecu_by_dataset.values())
    total_actual = sum(actual_eecu_by_dataset.values())

    # Fallback to rough estimates if no tracked data
    if total_estimated == 0:
        estimated_eecu_by_dataset = {
            "roads": round(roads_count * 0.000015, 6),
            "buildings": round(buildings_count * 0.00003, 6),
            "landcover": round(landcover_count * 0.000015, 6),
            "elevation": round(elevation_count * 0.0002, 6),
        }
        total_estimated = sum(estimated_eecu_by_dataset.values())
    
    # Monthly projection (60 districts)
    monthly_projection = total_estimated * 60

    # Last ingestion time
    last_ingestion = db.execute(
        select(func.max(ProcessingJob.completed_at))
        .where(
            ProcessingJob.job_type.in_(["ingest_district_terrain", "ingest_state_terrain"]),
            ProcessingJob.status == "succeeded",
        )
    ).scalar()

    return {
        "counts": {
            "roads": roads_count,
            "buildings": buildings_count,
            "landcover": landcover_count,
            "elevation_tiles": elevation_count,
            "parcel_profiles": profiles_count,
            "total_parcels": parcels_total,
            "coverage_pct": coverage_pct,
        },
        "districts": districts,
        "recent_jobs": jobs,
        "eecu_tracking": {
            "by_dataset_actual": {k: round(v, 6) for k, v in actual_eecu_by_dataset.items()},
            "by_dataset_estimated": {k: round(v, 6) for k, v in estimated_eecu_by_dataset.items()},
            "total_actual": round(total_actual, 6),
            "total_estimated": round(total_estimated, 6),
            "monthly_projection_60_districts": round(monthly_projection, 3),
        },
        "eecu_budget": {
            "free_tier_limit": 150,
            "remaining": max(0, round(150 - monthly_projection, 3)),
            "safety_margin_pct": round(max(0, (150 - monthly_projection) / 150 * 100), 1),
        },
        "last_ingestion": last_ingestion.isoformat() if last_ingestion else None,
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/ingest/{state_code}/{district}")
def trigger_district_ingestion(
    state_code: str,
    district: str,
    year: int = 2026,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles("ADMIN")),
):
    """Trigger terrain ingestion for a district (async Celery task)."""
    from app.tasks.terrain_tasks import ingest_district_terrain
    from app.models.processing_job import ProcessingJob
    from uuid import uuid4

    job = ProcessingJob(
        id=uuid4(),
        job_type="ingest_district_terrain",
        status="pending",
        payload={"state_code": state_code, "district": district, "year": year},
    )
    db.add(job)
    db.commit()

    ingest_district_terrain.delay(str(job.id), state_code, district, year)

    return {"job_id": str(job.id), "status": "queued", "message": f"Terrain ingestion queued for {state_code}/{district}"}


@router.post("/ingest/state/{state_code}")
def trigger_state_ingestion(
    state_code: str,
    year: int = 2026,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles("ADMIN")),
):
    """Trigger terrain ingestion for all districts in a state."""
    from app.tasks.terrain_tasks import ingest_state_terrain
    from app.models.processing_job import ProcessingJob
    from uuid import uuid4

    job = ProcessingJob(
        id=uuid4(),
        job_type="ingest_state_terrain",
        status="pending",
        payload={"state_code": state_code, "year": year},
    )
    db.add(job)
    db.commit()

    ingest_state_terrain.delay(str(job.id), state_code, year)

    return {"job_id": str(job.id), "status": "queued", "message": f"State terrain ingestion queued for {state_code}"}


@router.post("/profiles/{state_code}/{district}")
def trigger_profiles_computation(
    state_code: str,
    district: str,
    year: int = 2026,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles("ADMIN")),
):
    """Trigger parcel profile computation for a district."""
    from app.tasks.terrain_tasks import compute_parcel_profiles
    from app.models.processing_job import ProcessingJob
    from uuid import uuid4

    job = ProcessingJob(
        id=uuid4(),
        job_type="compute_parcel_profiles",
        status="pending",
        payload={"state_code": state_code, "district": district, "year": year},
    )
    db.add(job)
    db.commit()

    compute_parcel_profiles.delay(str(job.id), state_code, district, year)

    return {"job_id": str(job.id), "status": "queued", "message": f"Profile computation queued for {state_code}/{district}"}


@router.post("/profiles/refresh-all")
def trigger_refresh_all_profiles(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles("ADMIN")),
):
    """Trigger profile refresh for all districts."""
    from app.tasks.terrain_tasks import refresh_all_terrain_profiles
    from app.models.processing_job import ProcessingJob
    from uuid import uuid4

    job = ProcessingJob(
        id=uuid4(),
        job_type="refresh_all_terrain_profiles",
        status="pending",
        payload={},
    )
    db.add(job)
    db.commit()

    refresh_all_terrain_profiles.delay(str(job.id))

    return {"job_id": str(job.id), "status": "queued", "message": "Full terrain profile refresh queued for all districts"}


@router.get("/parcel/{parcel_id}")
def get_parcel_terrain_profile(
    parcel_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles("ADMIN")),
):
    """Get terrain profile for a specific parcel."""
    profile = db.query(ParcelTerrainProfile).filter(ParcelTerrainProfile.parcel_id == parcel_id).first()
    if not profile:
        return {"error": "Profile not found"}

    return {
        "parcel_id": str(profile.parcel_id),
        "elevation": {
            "mean_m": float(profile.mean_elevation_m),
            "min_m": float(profile.min_elevation_m),
            "max_m": float(profile.max_elevation_m),
            "range_m": float(profile.elevation_range_m),
        },
        "slope": {
            "mean_deg": float(profile.mean_slope_deg),
            "max_deg": float(profile.max_slope_deg),
            "steep_percentage": float(profile.steep_slope_percentage),
        },
        "land_cover": {
            "dominant": profile.dominant_land_cover,
            "mix": profile.land_cover_mix,
        },
        "infrastructure": {
            "nearest_road_distance_m": float(profile.nearest_road_distance_m),
            "nearest_road_type": profile.nearest_road_type,
            "road_access_score": float(profile.road_access_score),
        },
        "buildings": {
            "count": profile.building_count,
            "coverage_pct": float(profile.building_coverage_percentage),
            "density_per_ha": float(profile.building_density_per_ha),
        },
        "risk": {
            "flood_risk_score": float(profile.flood_risk_score),
            "constraints": profile.constraints,
        },
        "sources": profile.sources,
        "computed_at": profile.computed_at.isoformat() if profile.computed_at else None,
    }


@router.get("/job/{job_id}/eecu-report")
def get_job_eecu_report(
    job_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles("ADMIN")),
):
    """Get detailed EECU report for a specific job."""
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        return {"error": "Job not found"}
    
    if not job.dataset_status:
        return {"error": "No EECU tracking data for this job"}
    
    # Build summary from dataset_status
    operations = []
    for dataset, stats in job.dataset_status.items():
        if isinstance(stats, dict):
            operations.append({
                "dataset": dataset,
                "operations": stats.get("operations", 0),
                "estimated_eecu": stats.get("total_estimated_eecu", 0),
                "actual_eecu": stats.get("total_actual_eecu", 0),
                "feature_count": stats.get("feature_count", 0),
                "fallback_used": stats.get("fallback_used", False),
                "last_error": stats.get("last_error"),
            })
    
    total_estimated = sum(op["estimated_eecu"] for op in operations)
    total_actual = sum(op["actual_eecu"] for op in operations)
    monthly_projection = total_estimated * 60
    
    return {
        "job_id": str(job.id),
        "job_type": job.job_type,
        "status": job.status,
        "payload": job.payload,
        "operations": operations,
        "summary": {
            "total_estimated_eecu": round(total_estimated, 6),
            "total_actual_eecu": round(total_actual, 6),
            "monthly_projection_60_districts": round(monthly_projection, 3),
            "free_tier_limit": 150,
            "remaining": max(0, round(150 - monthly_projection, 3)),
            "safety_margin_pct": round(max(0, (150 - monthly_projection) / 150 * 100), 1),
        },
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
    }