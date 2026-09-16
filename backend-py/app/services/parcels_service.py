"""Ported from backend/src/parcels/parcels.service.ts.

backend-py has no SQLite fallback, so the isPostgisAvailable()-gated
choice in get_neighbours (real ST_Distance/ST_DWithin vs a JS point-in-
polygon scan over every same-state/district parcel) collapses to just
the real-PostGIS path, always. The Postgres-column-casing gotcha the TS
version's search_parcels EXISTS subquery had to work around
(TypeORM defaults to camelCase, quoted, columns) doesn't apply here -
SQLAlchemy's plain snake_case column names already match Postgres's own
default folding, so no manual quoting is needed.
"""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.common import supabase_storage
from app.common.geo_utils import polygon_distance_meters
from app.common.geometry_json import geometry_to_geojson
from app.common.parcel_generation.official_document_generator import render_official_document_pdf
from app.document_verification.authenticity import check_authenticity
from app.document_verification.field_matcher import text_contains_identifier
from app.document_verification.ocr import extract_text
from app.models.parcel import (
    CitizenParcel,
    OwnershipHistoryRecord,
    Parcel,
    ParcelDocument,
    ParcelHistoricalState,
    ParcelIdentifier,
    ParcelNeighbour,
)
from app.services.land_record_pdf_service import build_land_record_pdf_data

_DEFAULT_NEIGHBOUR_DISTANCE_M = 200
_TOUCH_EPSILON_M = 3


def _to_parcel_feature(parcel: Parcel) -> dict[str, Any]:
    return {
        "type": "Feature",
        "properties": {
            "id": str(parcel.id),
            "canonicalParcelId": parcel.canonical_parcel_id,
            "stateCode": parcel.state_code,
            "districtCode": parcel.district_code,
            "areaSqM": float(parcel.area_sq_m),
        },
        "geometry": geometry_to_geojson(parcel.geometry),
    }


def find_mine(db: Session, citizen_id: str) -> dict[str, Any]:
    # CitizenParcel has no `parcel` relationship() (plain citizen_id/
    # parcel_id FK columns only, see app/models/parcel.py) - one query for
    # the links, one for the parcels themselves.
    links = db.query(CitizenParcel).filter_by(citizen_id=citizen_id).all()
    parcel_ids = [link.parcel_id for link in links]
    parcels = db.query(Parcel).options(joinedload(Parcel.identifiers)).filter(Parcel.id.in_(parcel_ids)).all() if parcel_ids else []
    return {"parcels": parcels, "total": len(parcels)}


def is_citizen_associated_with_parcel(db: Session, citizen_id: str, parcel_id: str) -> bool:
    return db.query(CitizenParcel).filter_by(citizen_id=citizen_id, parcel_id=parcel_id).first() is not None


def get_ownership_history(db: Session, parcel_id: str) -> list[OwnershipHistoryRecord]:
    return db.query(OwnershipHistoryRecord).filter_by(parcel_id=parcel_id).order_by(OwnershipHistoryRecord.transaction_date.asc()).all()


def get_documents(db: Session, parcel_id: str) -> list[ParcelDocument]:
    return db.query(ParcelDocument).filter_by(parcel_id=parcel_id).order_by(ParcelDocument.created_at.asc()).all()


def get_document_file(db: Session, parcel_id: str, doc_id: str) -> tuple[bytes, str] | None:
    document = db.query(ParcelDocument).filter_by(id=doc_id, parcel_id=parcel_id).first()
    if not document or not document.file_path:
        return None
    try:
        buffer = supabase_storage.download_from_storage(document.file_path)
        return buffer, document.mime_type
    except Exception:  # noqa: BLE001
        # A bare row created on workflow approval for a parcel with
        # nothing seeded has no real image in storage.
        return None


def get_official_document_pdf(db: Session, parcel_id: str, lang: str) -> bytes | None:
    """Form 7/12-style Record of Rights PDF, generated on demand from real
    rows (BACKLOG.md item 14) - nothing persisted, no seed-time image. All
    data assembly lives in land_record_pdf_service.build_land_record_pdf_data;
    this is just the DB-lookup -> render hand-off.
    """
    parcel = db.get(Parcel, parcel_id)
    if parcel is None:
        return None
    data = build_land_record_pdf_data(db, parcel)
    return render_official_document_pdf(data, lang)


@dataclass
class IdentifyFromDocumentResult:
    extracted_text: str
    ocr_confidence: float
    candidates: list[Parcel]
    authenticity_suspicious: bool = False
    authenticity_reasons: list[str] | None = None


def identify_from_document(db: Session, image_bytes: bytes) -> IdentifyFromDocumentResult:
    """Upload-first Land Claim: OCRs an uploaded land document and
    identifies which real parcel it's for, so the citizen doesn't have to
    already know their ULPIN/survey number. Pure read - no persistence.
    """
    ocr = extract_text(image_bytes)
    authenticity = check_authenticity(image_bytes)
    if not ocr.text.strip():
        return IdentifyFromDocumentResult(
            extracted_text=ocr.text, ocr_confidence=ocr.confidence, candidates=[],
            authenticity_suspicious=authenticity.suspicious, authenticity_reasons=authenticity.reasons,
        )

    matched_parcel_ids: set[str] = set()

    parcels_with_ulpin = db.query(Parcel).filter(Parcel.ulpin.isnot(None)).all()
    for parcel in parcels_with_ulpin:
        if text_contains_identifier(ocr.text, parcel.ulpin):
            matched_parcel_ids.add(str(parcel.id))

    identifiers = db.query(ParcelIdentifier).options(joinedload(ParcelIdentifier.parcel)).all()
    for identifier in identifiers:
        if text_contains_identifier(ocr.text, identifier.identifier_value):
            matched_parcel_ids.add(str(identifier.parcel_id))

    candidates = (
        db.query(Parcel).filter(Parcel.id.in_(list(matched_parcel_ids)[:5])).all()
        if matched_parcel_ids
        else []
    )
    return IdentifyFromDocumentResult(
        extracted_text=ocr.text, ocr_confidence=ocr.confidence, candidates=candidates,
        authenticity_suspicious=authenticity.suspicious, authenticity_reasons=authenticity.reasons,
    )


def get_historical_states(db: Session, parcel_id: str, year: int | None = None) -> list[ParcelHistoricalState]:
    query = db.query(ParcelHistoricalState).filter_by(parcel_id=parcel_id)
    if year is not None:
        query = query.filter_by(year=year)
    return query.order_by(ParcelHistoricalState.year.asc()).all()


def search_parcels(
    db: Session,
    ulpin: str | None = None,
    survey_number: str | None = None,
    plot_number: str | None = None,
    local_identifier: str | None = None,
    state: str | None = None,
    district: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
) -> dict[str, Any]:
    query = db.query(Parcel).options(joinedload(Parcel.identifiers))

    if ulpin:
        query = query.filter(
            (Parcel.ulpin == ulpin) | Parcel.identifiers.any(identifier_type="ULPIN", identifier_value=ulpin)
        )
    if survey_number:
        query = query.filter(Parcel.identifiers.any(identifier_type="SURVEY_NUMBER", identifier_value=survey_number))
    if plot_number:
        query = query.filter(Parcel.identifiers.any(identifier_type="PLOT_NUMBER", identifier_value=plot_number))
    if local_identifier:
        query = query.filter(Parcel.identifiers.any(identifier_type="LOCAL_PARCEL_ID", identifier_value=local_identifier))
    if state:
        query = query.filter(Parcel.state_code == state)
    if district:
        query = query.filter(Parcel.district_code == district)

    total = query.distinct().count()
    if limit:
        query = query.limit(limit)
    if offset:
        query = query.offset(offset)

    parcels = query.all()
    return {"parcels": parcels, "total": total}


def find_one(db: Session, parcel_id: str) -> Parcel | None:
    return db.get(Parcel, parcel_id)


def get_geometry(db: Session, parcel_id: str) -> dict[str, Any] | None:
    parcel = db.get(Parcel, parcel_id)
    if not parcel:
        return None
    return {
        "type": "Feature",
        "properties": {"id": str(parcel.id), "canonicalParcelId": parcel.canonical_parcel_id},
        "geometry": geometry_to_geojson(parcel.geometry),
    }


def get_neighbours(db: Session, parcel_id: str, distance_meters: float | None = None) -> dict[str, Any] | None:
    """Adjacent (touching) and nearby parcels for contextual visibility,
    plus the selected parcel itself. Prefers explicit ParcelNeighbour rows
    (generated at seed time - reliable, matches the actual shared-boundary
    topology); falls back to a live ST_Distance/ST_DWithin query for
    parcels with no precomputed relationships (e.g. ad-hoc/non-seeded data).
    """
    selected = db.get(Parcel, parcel_id)
    if not selected:
        return None

    adjacent_parcels: list[dict[str, Any]] = []
    nearby_parcels: list[dict[str, Any]] = []

    selected_geojson = geometry_to_geojson(selected.geometry)

    def distance_to(parcel: Parcel) -> float | None:
        candidate_geojson = geometry_to_geojson(parcel.geometry)
        if not selected_geojson or not candidate_geojson:
            return None
        selected_ring = selected_geojson.get("coordinates", [[]])[0]
        candidate_ring = candidate_geojson.get("coordinates", [[]])[0]
        if len(selected_ring) < 2 or len(candidate_ring) < 2:
            return None
        ref_lat = sum(point[1] for point in selected_ring) / len(selected_ring)
        return polygon_distance_meters(selected_ring, candidate_ring, ref_lat)

    relationship_rows = db.query(ParcelNeighbour).filter_by(parcel_id=str(selected.id)).all()

    if relationship_rows:
        neighbour_ids = [row.neighbour_parcel_id for row in relationship_rows]
        neighbour_rows = db.query(Parcel).filter(Parcel.id.in_(neighbour_ids)).all()
        parcel_by_id = {str(parcel.id): parcel for parcel in neighbour_rows}

        for row in relationship_rows:
            parcel = parcel_by_id.get(row.neighbour_parcel_id)
            if not parcel:
                continue
            distance = distance_to(parcel)
            entry = {
                "parcelId": str(parcel.id), "canonicalParcelId": parcel.canonical_parcel_id,
                "relationship": row.relationship_type, "distanceMeters": round(float(distance), 1) if distance is not None else None,
                "feature": _to_parcel_feature(parcel),
            }
            (adjacent_parcels if row.relationship_type == "TOUCHING" else nearby_parcels).append(entry)
    else:
        max_distance = distance_meters if distance_meters and distance_meters > 0 else _DEFAULT_NEIGHBOUR_DISTANCE_M

        candidates = db.query(Parcel).filter(
            Parcel.state_code == selected.state_code,
            Parcel.district_code == selected.district_code,
            Parcel.id != selected.id,
        ).all()

        for candidate in candidates:
            distance = distance_to(candidate)
            if distance is None or distance > max(max_distance, _TOUCH_EPSILON_M):
                continue
            distance = round(float(distance), 1)
            entry = {
                "parcelId": str(candidate.id), "canonicalParcelId": candidate.canonical_parcel_id,
                "relationship": "TOUCHING" if distance <= _TOUCH_EPSILON_M else "NEARBY",
                "distanceMeters": distance, "feature": _to_parcel_feature(candidate),
            }
            if distance <= _TOUCH_EPSILON_M:
                adjacent_parcels.append(entry)
            elif distance <= max_distance:
                nearby_parcels.append(entry)

    adjacent_parcels.sort(key=lambda e: e["distanceMeters"] or 0)
    nearby_parcels.sort(key=lambda e: e["distanceMeters"] or 0)

    return {
        "selectedParcel": {
            "parcelId": str(selected.id), "canonicalParcelId": selected.canonical_parcel_id,
            "stateCode": selected.state_code, "districtCode": selected.district_code, "clusterId": selected.cluster_id,
            "feature": _to_parcel_feature(selected),
        },
        "adjacentParcels": adjacent_parcels,
        "nearbyParcels": nearby_parcels,
    }


def get_context(db: Session, parcel_id: str, distance_meters: float | None = None) -> dict[str, Any] | None:
    """Full spatial context for a selected parcel: itself, its adjacent/
    nearby neighbours, and every other parcel sharing its cluster_id.
    """
    neighbours = get_neighbours(db, parcel_id, distance_meters)
    if not neighbours:
        return None

    cluster_id = neighbours["selectedParcel"]["clusterId"]
    cluster_rows = db.query(Parcel).filter_by(cluster_id=cluster_id).all() if cluster_id else []
    cluster_parcels = (
        [{"parcelId": str(p.id), "canonicalParcelId": p.canonical_parcel_id, "feature": _to_parcel_feature(p)} for p in cluster_rows]
        if cluster_rows
        else [
            {
                "parcelId": neighbours["selectedParcel"]["parcelId"],
                "canonicalParcelId": neighbours["selectedParcel"]["canonicalParcelId"],
                "feature": neighbours["selectedParcel"]["feature"],
            }
        ]
    )

    return {
        "selectedParcel": neighbours["selectedParcel"],
        "cluster": {"clusterId": cluster_id},
        "clusterParcels": cluster_parcels,
        "adjacentParcels": neighbours["adjacentParcels"],
        "nearbyParcels": neighbours["nearbyParcels"],
    }
