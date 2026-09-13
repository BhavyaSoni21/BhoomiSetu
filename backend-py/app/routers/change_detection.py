"""Ported from backend/src/change-detection/change-detection.controller.ts.

Officer/admin-only - only the Officer Portal's ChangeDetectionPanel calls
this. Rate limiting (the TS side's tighter @Throttle - image decode/
resize/diff is real CPU work per request) is deferred to whenever
app-wide throttling is wired up for backend-py as a whole, not
reimplemented ad hoc per-route here.
"""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import Field
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.auth.roles import ALL_STAFF_ROLES
from app.database import get_db
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
