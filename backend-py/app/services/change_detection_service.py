"""Ported from backend/src/change-detection/change-detection.service.ts.

Tech.md #33's full pipeline (image T1/T2 -> preprocessing -> change
analysis -> change region -> spatial intersection -> affected parcel ->
governance alert). `sharp` -> Pillow for decode/resize; the spatial-
intersection step is real PostGIS (ST_Contains + ST_Centroid) always, not
the TS version's isPostgisAvailable()-gated choice between that and a
Python point-in-polygon scan over every parcel - backend-py has no
SQLite fallback to keep that branch for.
"""

import io
from dataclasses import dataclass
from typing import Any

from geoalchemy2.shape import from_shape
from PIL import Image
from shapely.geometry import Polygon, shape
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel
from app.models.spatial import ChangeDetectionEvent
from app.services.governance_rules_service import evaluate_rules_and_create_alerts
from app.services.image_diff import GeoBounds, diff_images, pixel_box_to_geo_box

# Both images are resized to this regardless of their original resolution,
# so the pixel-diff loop is fast and the pixel->geo mapping stays simple.
_ANALYSIS_SIZE = 200


@dataclass
class ChangeAnalysisResult:
    change_detected: bool
    changed_pixel_ratio: float
    change_region: dict[str, Any] | None
    event_id: str | None
    affected_parcel_ids: list[str]
    alerts_created: int


def _find_parcels_in_region(db: Session, region: dict[str, Any]) -> list[Parcel]:
    """Every parcel whose centroid falls inside a given GeoJSON Polygon
    region - a single real ST_Contains/ST_Centroid query.
    """
    region_geom = from_shape(shape(region), srid=4326)
    return db.query(Parcel).filter(func.ST_Contains(region_geom, func.ST_Centroid(Parcel.geometry))).all()


def analyze(db: Session, before: bytes, after: bytes, bounds: GeoBounds, description: str | None = None) -> ChangeAnalysisResult:
    before_raw = Image.open(io.BytesIO(before)).convert("RGBA").resize((_ANALYSIS_SIZE, _ANALYSIS_SIZE)).tobytes()
    after_raw = Image.open(io.BytesIO(after)).convert("RGBA").resize((_ANALYSIS_SIZE, _ANALYSIS_SIZE)).tobytes()

    diff = diff_images(before_raw, after_raw, _ANALYSIS_SIZE, _ANALYSIS_SIZE)
    if not diff.changed or not diff.bbox:
        return ChangeAnalysisResult(
            change_detected=False, changed_pixel_ratio=diff.changed_pixel_ratio, change_region=None,
            event_id=None, affected_parcel_ids=[], alerts_created=0,
        )

    geo_box = pixel_box_to_geo_box(diff.bbox, _ANALYSIS_SIZE, _ANALYSIS_SIZE, bounds)
    change_ring = [
        (geo_box.min_lng, geo_box.min_lat), (geo_box.max_lng, geo_box.min_lat),
        (geo_box.max_lng, geo_box.max_lat), (geo_box.min_lng, geo_box.max_lat), (geo_box.min_lng, geo_box.min_lat),
    ]
    change_region = {"type": "Polygon", "coordinates": [[list(p) for p in change_ring]]}

    # SPATIAL INTERSECTION: every parcel whose centroid falls inside the
    # detected change region.
    affected_parcels = _find_parcels_in_region(db, change_region)
    affected_parcel_ids = [str(p.id) for p in affected_parcels]

    event = ChangeDetectionEvent(
        description=description or f"Change detected via uploaded imagery comparison ({diff.changed_pixel_ratio * 100:.1f}% of analyzed area)",
        state_code=affected_parcels[0].state_code if affected_parcels else "UNK",
        district=affected_parcels[0].district_code if affected_parcels else "UNK",
        geometry=from_shape(Polygon(change_ring), srid=4326),
        affected_parcel_ids=affected_parcel_ids,
    )
    db.add(event)
    db.flush()

    # GOVERNANCE ALERTS: use admin-editable rules instead of hardcoded logic
    alerts_created = 0
    if affected_parcel_ids:
        for parcel_id in affected_parcel_ids:
            created_alerts = evaluate_rules_and_create_alerts(
                db,
                alert_type="UNAUTHORIZED_CHANGE_DETECTED",
                parcel_id=parcel_id,
                context={
                    "changed_pixel_ratio": diff.changed_pixel_ratio,
                    "change_region": change_region,
                    "parcel_id": parcel_id,
                },
            )
            alerts_created += len(created_alerts)

    return ChangeAnalysisResult(
        change_detected=True, changed_pixel_ratio=diff.changed_pixel_ratio, change_region=change_region,
        event_id=str(event.id), affected_parcel_ids=affected_parcel_ids, alerts_created=alerts_created,
    )
