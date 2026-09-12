"""Ported from backend/src/spatial/spatial.controller.ts + spatial.service.ts.

Shares the `/gis` path prefix with app/routers/gis.py - same as the TS
side, where both GisController and SpatialController are `@Controller('gis')`.
Write endpoints (and every admin-notes endpoint, reads included) are
ADMIN-only - maintaining reference/master spatial data, not a day-to-day
officer action.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.database import get_db
from app.models.spatial import AdminMapNote, ChangeDetectionEvent, InfrastructureFeature, RestrictionZone, ZoningOverlay
from app.models.user import User
from app.schemas.spatial import (
    AdminMapNoteOut,
    CreateAdminMapNote,
    CreateInfrastructureFeature,
    CreateRestrictionZone,
    CreateZoningOverlay,
    FeatureCollection,
    InfrastructureFeatureOut,
    RestrictionZoneOut,
    UpdateAdminMapNote,
    UpdateInfrastructureFeature,
    UpdateRestrictionZone,
    UpdateZoningOverlay,
    ZoningOverlayOut,
    to_feature_collection,
)
from app.services.spatial_service import (
    assert_geometry_type,
    compute_affected_parcel_ids,
    create_overlap_alerts,
    geojson_to_geometry,
    reject_if_overlapping,
)

router = APIRouter(prefix="/gis", tags=["spatial"])


def _area_filter(query, model, state: str | None, district: str | None):
    if state:
        query = query.filter(model.state_code == state)
    if district:
        query = query.filter(model.district == district)
    return query


# --- Reads (public) -----------------------------------------------------


@router.get("/zoning-overlays", response_model=FeatureCollection)
def get_zoning_overlays(state: str | None = None, district: str | None = None, db: Session = Depends(get_db)):
    rows = _area_filter(db.query(ZoningOverlay), ZoningOverlay, state, district).all()
    return to_feature_collection(
        rows,
        lambda r: {
            "id": r.id, "name": r.name, "zoneType": r.zone_type, "stateCode": r.state_code, "district": r.district,
            "parcelIds": r.parcel_ids or [], "parcelCount": len(r.parcel_ids or []),
        },
    )


@router.get("/restriction-zones", response_model=FeatureCollection)
def get_restriction_zones(state: str | None = None, district: str | None = None, db: Session = Depends(get_db)):
    rows = _area_filter(db.query(RestrictionZone), RestrictionZone, state, district).all()
    return to_feature_collection(
        rows,
        lambda r: {
            "id": r.id, "name": r.name, "restrictionType": r.restriction_type, "stateCode": r.state_code,
            "district": r.district, "affectedParcelIds": r.affected_parcel_ids or [],
        },
    )


@router.get("/infrastructure", response_model=FeatureCollection)
def get_infrastructure(state: str | None = None, district: str | None = None, db: Session = Depends(get_db)):
    rows = _area_filter(db.query(InfrastructureFeature), InfrastructureFeature, state, district).all()
    return to_feature_collection(
        rows,
        lambda r: {"id": r.id, "name": r.name, "featureType": r.feature_type, "stateCode": r.state_code, "district": r.district},
    )


@router.get("/change-detection-events", response_model=FeatureCollection)
def get_change_detection_events(state: str | None = None, district: str | None = None, db: Session = Depends(get_db)):
    rows = _area_filter(db.query(ChangeDetectionEvent), ChangeDetectionEvent, state, district).all()
    return to_feature_collection(
        rows,
        lambda r: {"id": r.id, "description": r.description, "affectedParcelIds": r.affected_parcel_ids or [], "detectedAt": r.detected_at.isoformat()},
    )


# --- Zoning overlays (admin write) ---------------------------------------


@router.post("/zoning-overlays", response_model=ZoningOverlayOut, status_code=status.HTTP_201_CREATED)
def create_zoning_overlay(dto: CreateZoningOverlay, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    assert_geometry_type(dto.geometry, ["Polygon"])
    geom = geojson_to_geometry(dto.geometry)
    reject_if_overlapping(db, ZoningOverlay, geom)
    parcel_ids = compute_affected_parcel_ids(db, geom)
    row = ZoningOverlay(name=dto.name, zone_type=dto.zone_type, state_code=dto.state_code, district=dto.district, geometry=geom, parcel_ids=parcel_ids)
    db.add(row)
    db.flush()
    return row


@router.patch("/zoning-overlays/{id}", response_model=ZoningOverlayOut)
def update_zoning_overlay(id: UUID, dto: UpdateZoningOverlay, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    row = db.get(ZoningOverlay, id)
    if not row:
        raise _not_found("Zoning overlay", id)
    updates = dto.model_dump(exclude_unset=True, by_alias=False)
    if dto.geometry is not None:
        assert_geometry_type(dto.geometry, ["Polygon"])
        geom = geojson_to_geometry(dto.geometry)
        reject_if_overlapping(db, ZoningOverlay, geom, exclude_id=id)
        row.parcel_ids = compute_affected_parcel_ids(db, geom)
        row.geometry = geom
        updates.pop("geometry", None)
    for key, value in updates.items():
        setattr(row, key, value)
    db.flush()
    return row


@router.delete("/zoning-overlays/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zoning_overlay(id: UUID, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    row = db.get(ZoningOverlay, id)
    if not row:
        raise _not_found("Zoning overlay", id)
    db.delete(row)
    db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Restriction zones (admin write) --------------------------------------


@router.post("/restriction-zones", response_model=RestrictionZoneOut, status_code=status.HTTP_201_CREATED)
def create_restriction_zone(dto: CreateRestrictionZone, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    assert_geometry_type(dto.geometry, ["Polygon"])
    geom = geojson_to_geometry(dto.geometry)
    reject_if_overlapping(db, RestrictionZone, geom)
    affected_parcel_ids = compute_affected_parcel_ids(db, geom)
    row = RestrictionZone(
        name=dto.name, restriction_type=dto.restriction_type, state_code=dto.state_code, district=dto.district,
        geometry=geom, affected_parcel_ids=affected_parcel_ids,
    )
    db.add(row)
    db.flush()
    create_overlap_alerts(db, affected_parcel_ids)
    db.flush()
    return row


@router.patch("/restriction-zones/{id}", response_model=RestrictionZoneOut)
def update_restriction_zone(id: UUID, dto: UpdateRestrictionZone, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    row = db.get(RestrictionZone, id)
    if not row:
        raise _not_found("Restriction zone", id)
    previous_parcel_ids = row.affected_parcel_ids or []
    updates = dto.model_dump(exclude_unset=True, by_alias=False)
    geometry_changed = dto.geometry is not None
    if geometry_changed:
        assert_geometry_type(dto.geometry, ["Polygon"])
        geom = geojson_to_geometry(dto.geometry)
        reject_if_overlapping(db, RestrictionZone, geom, exclude_id=id)
        row.affected_parcel_ids = compute_affected_parcel_ids(db, geom)
        row.geometry = geom
        updates.pop("geometry", None)
    for key, value in updates.items():
        setattr(row, key, value)
    db.flush()
    if geometry_changed:
        create_overlap_alerts(db, row.affected_parcel_ids or [], previous_parcel_ids)
        db.flush()
    return row


@router.delete("/restriction-zones/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_restriction_zone(id: UUID, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    row = db.get(RestrictionZone, id)
    if not row:
        raise _not_found("Restriction zone", id)
    db.delete(row)
    db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Infrastructure features (admin write) --------------------------------


@router.post("/infrastructure", response_model=InfrastructureFeatureOut, status_code=status.HTTP_201_CREATED)
def create_infrastructure_feature(dto: CreateInfrastructureFeature, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    assert_geometry_type(dto.geometry, ["Point", "LineString"])
    row = InfrastructureFeature(
        name=dto.name, feature_type=dto.feature_type, state_code=dto.state_code, district=dto.district,
        geometry=geojson_to_geometry(dto.geometry),
    )
    db.add(row)
    db.flush()
    return row


@router.patch("/infrastructure/{id}", response_model=InfrastructureFeatureOut)
def update_infrastructure_feature(id: UUID, dto: UpdateInfrastructureFeature, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    row = db.get(InfrastructureFeature, id)
    if not row:
        raise _not_found("Infrastructure feature", id)
    updates = dto.model_dump(exclude_unset=True, by_alias=False)
    if dto.geometry is not None:
        assert_geometry_type(dto.geometry, ["Point", "LineString"])
        row.geometry = geojson_to_geometry(dto.geometry)
        updates.pop("geometry", None)
    for key, value in updates.items():
        setattr(row, key, value)
    db.flush()
    return row


@router.delete("/infrastructure/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_infrastructure_feature(id: UUID, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    row = db.get(InfrastructureFeature, id)
    if not row:
        raise _not_found("Infrastructure feature", id)
    db.delete(row)
    db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Admin map notes (admin-only layer - read AND write both gated) ------


@router.get("/admin-notes", response_model=FeatureCollection)
def get_admin_map_notes(state: str | None = None, district: str | None = None, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    rows = _area_filter(db.query(AdminMapNote), AdminMapNote, state, district).all()
    return to_feature_collection(
        rows,
        lambda r: {"id": r.id, "name": r.name, "notes": r.notes, "stateCode": r.state_code, "district": r.district, "createdByUserId": r.created_by_user_id},
    )


@router.post("/admin-notes", response_model=AdminMapNoteOut, status_code=status.HTTP_201_CREATED)
def create_admin_map_note(dto: CreateAdminMapNote, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    assert_geometry_type(dto.geometry, ["Point", "LineString", "Polygon"])
    row = AdminMapNote(
        name=dto.name, notes=dto.notes, state_code=dto.state_code, district=dto.district,
        geometry=geojson_to_geometry(dto.geometry), created_by_user_id=str(admin.id),
    )
    db.add(row)
    db.flush()
    return row


@router.patch("/admin-notes/{id}", response_model=AdminMapNoteOut)
def update_admin_map_note(id: UUID, dto: UpdateAdminMapNote, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    row = db.get(AdminMapNote, id)
    if not row:
        raise _not_found("Admin map note", id)
    updates = dto.model_dump(exclude_unset=True, by_alias=False)
    if dto.geometry is not None:
        assert_geometry_type(dto.geometry, ["Point", "LineString", "Polygon"])
        row.geometry = geojson_to_geometry(dto.geometry)
        updates.pop("geometry", None)
    for key, value in updates.items():
        setattr(row, key, value)
    db.flush()
    return row


@router.delete("/admin-notes/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_map_note(id: UUID, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    row = db.get(AdminMapNote, id)
    if not row:
        raise _not_found("Admin map note", id)
    db.delete(row)
    db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _not_found(label: str, id: UUID) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{label} not found: {id}")
