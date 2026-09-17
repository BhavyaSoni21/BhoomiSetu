"""Ported from backend/src/gis/gis.controller.ts + gis.service.ts.

backend-py has no SQLite fallback, so the isPostgisAvailable() branch in
the TS service (bbox filtering silently skipped, with a console.warn,
under SQLite dev mode) has no equivalent here - ST_Intersects always runs.
This is exactly the module PYTHON_MIGRATION_PLAN.md §1 means by "real
spatial analysis instead of hand-rolled query strings": real PostGIS, not
a conditional fallback.
"""

from uuid import UUID
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.common.geometry_json import geometry_to_geojson
from app.database import get_db
from app.models.parcel import Parcel
from app.schemas.parcel import ParcelFeature, ParcelFeatureProperties, ParcelListResponse, ParcelOut

router = APIRouter(prefix="/gis", tags=["gis"])


def _parse_bbox(bbox: str | None) -> tuple[float, float, float, float] | None:
    if not bbox:
        return None
    parts = bbox.split(",")
    if len(parts) != 4:
        return None
    try:
        min_x, min_y, max_x, max_y = (float(p) for p in parts)
    except ValueError:
        return None
    return min_x, min_y, max_x, max_y


@router.get("/parcels", response_model=ParcelListResponse)
def get_parcels(
    db: Session = Depends(get_db),
    bbox: str | None = Query(None),
    zoom: float | None = Query(None),  # accepted for parity with the TS signature; unused there too
    state: str | None = Query(None),
    district: str | None = Query(None),
    limit: int | None = Query(None),
    offset: int | None = Query(None),
):
    query = db.query(Parcel)

    parsed_bbox = _parse_bbox(bbox)
    if parsed_bbox:
        min_x, min_y, max_x, max_y = parsed_bbox
        query = query.filter(func.ST_Intersects(Parcel.geometry, func.ST_MakeEnvelope(min_x, min_y, max_x, max_y, 4326)))

    if state:
        query = query.filter(Parcel.state_code == state)
    if district:
        query = query.filter(Parcel.district_code == district)

    total = query.count()
    if limit:
        query = query.limit(limit)
    if offset:
        query = query.offset(offset)

    parcels = query.all()
    return ParcelListResponse(parcels=[ParcelOut.model_validate(p) for p in parcels], total=total)


@router.get("/parcels/{id}/geometry")
def get_parcel_geometry(id: UUID, db: Session = Depends(get_db)):
    parcel = db.get(Parcel, id)
    if not parcel:
        # Matches the TS controller returning `null` from a Nest handler,
        # which Express/supertest surface as an empty body - {} is the
        # closest faithful equivalent as an actual JSON response.
        return {}
    return ParcelFeature(
        properties=ParcelFeatureProperties.model_validate(parcel),
        geometry=geometry_to_geojson(parcel.geometry),
    )


@router.get("/parcels/{id}/restrictions")
def get_parcel_restrictions(id: UUID, db: Session = Depends(get_db)):
    # Placeholder, matching the TS service exactly - this would typically
    # query a restrictions table or service.
    return []


@router.get("/clusters-hierarchical")
def get_clusters_hierarchical(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """
    Returns clusters grouped hierarchically: State -> District -> City/Village (Cluster).
    Each cluster includes its bounds for map viewport fitting.
    Used by the unified map's hierarchical dropdown selector.
    """
    rows = (
        db.query(
            Parcel.cluster_id,
            Parcel.state_code,
            Parcel.district_code,
            func.min(func.ST_XMin(Parcel.geometry)).label("min_lng"),
            func.min(func.ST_YMin(Parcel.geometry)).label("min_lat"),
            func.max(func.ST_XMax(Parcel.geometry)).label("max_lng"),
            func.max(func.ST_YMax(Parcel.geometry)).label("max_lat"),
        )
        .filter(Parcel.cluster_id.isnot(None))
        .group_by(Parcel.cluster_id, Parcel.state_code, Parcel.district_code)
        .order_by(Parcel.state_code, Parcel.district_code, Parcel.cluster_id)
        .all()
    )

    # Build hierarchy: state -> district -> clusters
    state_map: dict[str, dict[str, Any]] = {}
    for row in rows:
        cluster_id, state_code, district_code, min_lng, min_lat, max_lng, max_lat = row
        if state_code not in state_map:
            state_map[state_code] = {"stateCode": state_code, "districts": {}}
        state = state_map[state_code]
        if district_code not in state["districts"]:
            state["districts"][district_code] = {"districtCode": district_code, "clusters": []}
        district = state["districts"][district_code]
        district["clusters"].append({
            "clusterId": cluster_id,
            "bounds": {
                "minLng": min_lng,
                "minLat": min_lat,
                "maxLng": max_lng,
                "maxLat": max_lat,
            },
        })

    # Convert to list format expected by frontend
    result = []
    for state_code, state_data in state_map.items():
        districts_list = []
        for district_code, district_data in state_data["districts"].items():
            districts_list.append({
                "districtCode": district_data["districtCode"],
                "clusters": district_data["clusters"],
            })
        result.append({
            "stateCode": state_data["stateCode"],
            "districts": districts_list,
        })

    return result
