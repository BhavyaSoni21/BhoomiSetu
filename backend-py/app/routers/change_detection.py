"""Ported from backend/src/change-detection/change-detection.controller.ts.

Officer/admin-only - only the Officer Portal's ChangeDetectionPanel calls
this. Rate limiting (the TS side's tighter @Throttle - image decode/
resize/diff is real CPU work per request) is deferred to whenever
app-wide throttling is wired up for backend-py as a whole, not
reimplemented ad hoc per-route here.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.auth.roles import ALL_STAFF_ROLES
from app.common.parcel_generation.cluster_generator import CLUSTER_CONFIGS
from app.database import get_db
from app.models.parcel import Parcel
from app.schemas.base import CamelModel
from app.services import earth_engine_service
from app.services.change_detection_service import analyze
from app.services.image_diff import GeoBounds

router = APIRouter(prefix="/change-detection", tags=["change-detection"])

_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB per image


class ChangeAnalysisResultOut(CamelModel):
    change_detected: bool
    changed_pixel_ratio: float
    change_region: dict | None
    event_id: str | None
    affected_parcel_ids: list[str]
    alerts_created: int


class SatelliteBoundsIn(CamelModel):
    min_lng: float = Field(ge=-180, le=180)
    min_lat: float = Field(ge=-90, le=90)
    max_lng: float = Field(ge=-180, le=180)
    max_lat: float = Field(ge=-90, le=90)


class SatelliteAnalysisIn(CamelModel):
    bounds: SatelliteBoundsIn
    before_date: date
    after_date: date
    description: str | None = Field(default=None, max_length=200)


class ClusterOptionOut(CamelModel):
    cluster_id: str
    state_code: str
    district: str
    type: str  # "city" | "village"
    bounds: SatelliteBoundsIn


@router.get("/clusters", response_model=list[ClusterOptionOut])
def list_clusters(
    db: Session = Depends(get_db),
    _staff: object = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Lets the Change Detection UI offer a state/village picker instead of
    asking an officer to type raw lng/lat bounds by hand. Bounds come from
    the real seeded parcel geometry (PostGIS extent), not reconstructed
    from the generator config, so they're always tight around what's
    actually in the DB; the friendly district/village name still comes
    from CLUSTER_CONFIGS since that's not persisted anywhere on Parcel.
    """
    district_by_cluster = {c.cluster_id: c.district for c in CLUSTER_CONFIGS}
    rows = (
        db.query(
            Parcel.cluster_id,
            Parcel.state_code,
            func.min(func.ST_XMin(Parcel.geometry)).label("min_lng"),
            func.min(func.ST_YMin(Parcel.geometry)).label("min_lat"),
            func.max(func.ST_XMax(Parcel.geometry)).label("max_lng"),
            func.max(func.ST_YMax(Parcel.geometry)).label("max_lat"),
        )
        .filter(Parcel.cluster_id.isnot(None))
        .group_by(Parcel.cluster_id, Parcel.state_code)
        .order_by(Parcel.cluster_id)
        .all()
    )
    return [
        ClusterOptionOut(
            cluster_id=row.cluster_id,
            state_code=row.state_code,
            district=district_by_cluster.get(row.cluster_id, row.cluster_id),
            type="village" if "VILLAGE" in row.cluster_id else "city",
            bounds=SatelliteBoundsIn(min_lng=row.min_lng, min_lat=row.min_lat, max_lng=row.max_lng, max_lat=row.max_lat),
        )
        for row in rows
    ]


@router.get("/clusters/{cluster_id}/satellite-image")
def get_cluster_satellite_image(
    cluster_id: str,
    for_date: Annotated[date, Query(alias="date")],
    db: Session = Depends(get_db),
    _staff: object = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """A real true-color satellite photo of one cluster's actual parcel
    footprint for a given date - what Parcel 360's officer-facing
    "Satellite Photo" toggle shows instead of the category-colored parcel
    map (HistoricalMapView.tsx), reusing the same real-geometry bounds
    computation as /clusters above, just scoped to one cluster.
    """
    row = (
        db.query(
            func.min(func.ST_XMin(Parcel.geometry)).label("min_lng"),
            func.min(func.ST_YMin(Parcel.geometry)).label("min_lat"),
            func.max(func.ST_XMax(Parcel.geometry)).label("max_lng"),
            func.max(func.ST_YMax(Parcel.geometry)).label("max_lat"),
        )
        .filter(Parcel.cluster_id == cluster_id)
        .one()
    )
    if row.min_lng is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No parcels found for cluster {cluster_id}")

    bounds = GeoBounds(min_lng=row.min_lng, min_lat=row.min_lat, max_lng=row.max_lng, max_lat=row.max_lat)
    png_bytes = earth_engine_service.get_true_color_visual_png(bounds, for_date)
    return Response(content=png_bytes, media_type="image/png")


@router.post("/analyze", response_model=ChangeAnalysisResultOut, status_code=status.HTTP_201_CREATED)
async def analyze_change(
    before: Annotated[UploadFile, File()],
    after: Annotated[UploadFile, File()],
    min_lng: Annotated[float, Form(alias="minLng", ge=-180, le=180)],
    min_lat: Annotated[float, Form(alias="minLat", ge=-90, le=90)],
    max_lng: Annotated[float, Form(alias="maxLng", ge=-180, le=180)],
    max_lat: Annotated[float, Form(alias="maxLat", ge=-90, le=90)],
    description: Annotated[str | None, Form(max_length=200)] = None,
    db: Session = Depends(get_db),
    _staff: object = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    if not (before.content_type or "").startswith("image/") or not (after.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Both files must be images')

    before_bytes = await before.read()
    after_bytes = await after.read()
    if len(before_bytes) > _MAX_IMAGE_BYTES or len(after_bytes) > _MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image exceeds the 5MB size limit")

    result = analyze(
        db, before_bytes, after_bytes,
        GeoBounds(min_lng=min_lng, min_lat=min_lat, max_lng=max_lng, max_lat=max_lat),
        description,
    )
    return ChangeAnalysisResultOut(
        change_detected=result.change_detected, changed_pixel_ratio=result.changed_pixel_ratio,
        change_region=result.change_region, event_id=result.event_id,
        affected_parcel_ids=result.affected_parcel_ids, alerts_created=result.alerts_created,
    )


@router.post("/analyze-satellite", response_model=ChangeAnalysisResultOut, status_code=status.HTTP_201_CREATED)
def analyze_change_satellite(
    body: SatelliteAnalysisIn,
    db: Session = Depends(get_db),
    _staff: object = Depends(require_roles(*ALL_STAFF_ROLES)),
):
    """Same pipeline as /analyze, but the before/after imagery is real
    Sentinel-2 satellite data fetched from Earth Engine for the given
    bounds/dates instead of an officer's own uploaded photos - no file
    upload needed. 503s if Earth Engine isn't configured (see
    earth_engine_service.py); the manual-upload endpoint above is
    unaffected either way.
    """
    if body.after_date < body.before_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="afterDate must not be earlier than beforeDate")

    bounds = GeoBounds(
        min_lng=body.bounds.min_lng, min_lat=body.bounds.min_lat,
        max_lng=body.bounds.max_lng, max_lat=body.bounds.max_lat,
    )
    before_bytes = earth_engine_service.get_ndvi_visual_png(bounds, body.before_date)
    after_bytes = earth_engine_service.get_ndvi_visual_png(bounds, body.after_date)

    result = analyze(db, before_bytes, after_bytes, bounds, body.description)
    return ChangeAnalysisResultOut(
        change_detected=result.change_detected, changed_pixel_ratio=result.changed_pixel_ratio,
        change_region=result.change_region, event_id=result.event_id,
        affected_parcel_ids=result.affected_parcel_ids, alerts_created=result.alerts_created,
    )
