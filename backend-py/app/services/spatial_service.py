"""Ported from backend/src/spatial/spatial.service.ts.

Two real PostGIS upgrades over the TS version's hand-rolled geo-utils.ts
math (PYTHON_MIGRATION_PLAN.md §1's actual point):
- reject_if_overlapping used geo-utils.ts's ringsOverlap (vertex-in-ring +
  edge-crossing checks in application code) -> ST_Intersects.
- compute_affected_parcel_ids fetched *every* parcel row and tested each
  centroid in Python -> a single ST_Within(ST_Centroid(...)) query,
  computed by PostGIS itself instead of iterating every parcel over the
  wire.
"""

from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from geoalchemy2.elements import WKBElement
from geoalchemy2.shape import from_shape
from shapely.geometry import shape
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.parcel import Parcel
from app.services.governance_rules_service import evaluate_rules_and_create_alerts


def geojson_to_geometry(geojson: dict[str, Any]) -> WKBElement:
    return from_shape(shape(geojson), srid=4326)


def assert_geometry_type(geometry: dict[str, Any], allowed: list[str]) -> None:
    if geometry.get("type") not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"geometry.type must be one of: {', '.join(allowed)}")


def reject_if_overlapping(db: Session, model, geom: WKBElement, exclude_id: UUID | None = None) -> None:
    """"Zone" here means the two polygon layers only (zoning overlays,
    restriction zones) - infrastructure/admin-notes aren't checked, and a
    zoning overlay is only ever compared against other zoning overlays, a
    restriction zone only against other restriction zones (a flood zone
    and a residential zoning classification can legitimately cover the
    same land). exclude_id lets an update skip comparing a zone against
    itself.
    """
    query = db.query(model).filter(func.ST_Intersects(model.geometry, geom))
    if exclude_id is not None:
        query = query.filter(model.id != exclude_id)
    existing = query.first()
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'This zone\'s geometry overlaps an existing zone: "{existing.name}". Adjust the geometry or edit the existing zone instead.',
        )


def compute_affected_parcel_ids(db: Session, geom: WKBElement) -> list[str]:
    """Authoritative "which parcels does this zone actually affect" -
    trusts a real spatial query, never whatever affected_parcel_ids/
    parcel_ids the client sent.
    """
    rows = db.query(Parcel.id).filter(func.ST_Within(func.ST_Centroid(Parcel.geometry), geom)).all()
    return [str(row[0]) for row in rows]


def create_overlap_alerts(db: Session, parcel_ids: list[str], previous_parcel_ids: list[str] | None = None) -> None:
    """One GovernanceAlert per newly-affected parcel. "Newly" matters on
    update - a parcel already in previous_parcel_ids already has (or had)
    its alert, so re-flagging it would just spam duplicate OPEN alerts.

    Uses admin-editable governance rules instead of hardcoded logic.
    """
    previous = set(previous_parcel_ids or [])
    newly_affected = [pid for pid in parcel_ids if pid not in previous]
    if not newly_affected:
        return

    for parcel_id in newly_affected:
        evaluate_rules_and_create_alerts(
            db,
            alert_type="RESTRICTION_ZONE_OVERLAP",
            parcel_id=parcel_id,
            context={
                "intersects": True,
                "parcel_id": parcel_id,
                "zone_name": "admin-defined restriction zone",
            },
        )
