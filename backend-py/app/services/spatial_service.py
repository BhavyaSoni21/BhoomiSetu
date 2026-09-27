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
from shapely.validation import explain_validity
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.parcel import Parcel
from app.services.governance_rules_service import evaluate_rules_and_create_alerts

# Snap tolerance for keeping adjacent zoning overlays edge-shared, in SRID
# 4326 degrees (~0.0005° ≈ 55 m at India's latitudes). A zone boundary
# drawn or edited to within this distance of a neighbour snaps onto the
# neighbour's exact edge, so the two keep a common boundary instead of
# leaving a sliver gap or a thin overlap (the "zones collapse / don't share
# a boundary" symptom). ponytail: single global tolerance — make it
# per-district only if zone scales vary enough for one value to misbehave.
ZONE_SNAP_TOLERANCE_DEG = 0.0005


def geojson_to_geometry(geojson: dict[str, Any]) -> WKBElement:
    geom = shape(geojson)
    # Reject self-intersecting / malformed polygons before they reach PostGIS,
    # where they'd corrupt ST_Intersects/ST_Within results downstream.
    if not geom.is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid geometry: {explain_validity(geom)}",
        )
    return from_shape(geom, srid=4326)


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


def snap_zone_to_shared_edges(db: Session, model, geom: WKBElement, exclude_id: UUID | None = None) -> WKBElement:
    """Keep adjacent zoning overlays sharing an exact boundary instead of
    forbidding all contact the way reject_if_overlapping does.

    1. Snap the incoming geometry onto every same-type zone within
       ZONE_SNAP_TOLERANCE_DEG, so an edge meant to be shared becomes
       geometrically identical to the neighbour's edge (removes sliver gaps
       and thin overlaps - the symptom the user reported).
    2. A shared edge (a zero-area touch) is then allowed; only a genuine
       interior *overlap* is rejected.

    ponytail: this is snap-to-coverage, not full planar topology. Editing a
    shared edge does NOT drag the neighbour's edge along with it, and
    shrinking a zone away from its neighbour leaves a gap. If zones must
    stay a gapless coverage under arbitrary edits, upgrade to the PostGIS
    topology extension (TopoGeometry) where faces share stored edges.
    """
    neighbours = db.query(model.geometry).filter(
        func.ST_DWithin(model.geometry, geom, ZONE_SNAP_TOLERANCE_DEG)
    )
    if exclude_id is not None:
        neighbours = neighbours.filter(model.id != exclude_id)

    snapped = geom
    for (neighbour_geom,) in neighbours.all():
        snapped = db.scalar(select(func.ST_Snap(snapped, neighbour_geom, ZONE_SNAP_TOLERANCE_DEG)))

    # Allow a shared edge; reject any real interior overlap. ST_Overlaps is
    # false for identical or contained geometry (it only fires on *partial*
    # overlap), which let a duplicate/nested zone slip through. The DE-9IM
    # interior-interior test ("T********") is true whenever the two interiors
    # actually intersect - covering equal, contained, and partial overlap -
    # while a pure edge-touch (boundary-only, empty interior intersection)
    # stays allowed.
    overlapping = db.query(model.name).filter(func.ST_Relate(model.geometry, snapped, 'T********'))
    if exclude_id is not None:
        overlapping = overlapping.filter(model.id != exclude_id)
    hit = overlapping.first()
    if hit is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'This zone overlaps the interior of an existing zone: "{hit[0]}". Adjacent zones may share an edge, but not overlap.',
        )
    return snapped


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
