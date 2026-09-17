"""Ported from backend/src/interoperability/response-aggregator.service.ts.

Tech.md #22's "RESPONSE AGGREGATION" stage: calls every department
lookup, runs the Land Records result through the State A/B adapter,
transforms everything into the canonical envelope, and merges in the raw
per-department payloads so Parcel 360 is genuinely useful (not just a
pointer saying data exists). This is what GET /api/v1/parcels/:id/360
calls - see app/routers/parcels.py.
"""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.canonical_transformer import build_canonical_envelope
from app.common.land_record_adapters import adapt_land_records_result
from app.models.parcel import Parcel, ParcelIdentifier
from app.services import departments_service, land_records_lookup_service


def build_parcel_360(db: Session, parcel_id: str) -> dict | None:
    parcel = db.get(Parcel, parcel_id)
    if parcel is None:
        return None

    identifier_rows = list(db.scalars(select(ParcelIdentifier).where(ParcelIdentifier.parcel_id == parcel_id)).all())

    def find_type(identifier_type: str) -> str | None:
        return next((row.identifier_value for row in identifier_rows if row.identifier_type == identifier_type), None)

    land_records_result = land_records_lookup_service.find_by_parcel_id(db, parcel_id)
    registration = departments_service.find_registration_by_parcel(db, parcel_id)
    planning = departments_service.find_planning_by_parcel(db, parcel_id)
    tax = departments_service.find_tax_by_parcel(db, parcel_id)
    restriction = departments_service.find_restriction_by_parcel(db, parcel_id)
    dispute = departments_service.find_dispute_by_parcel(db, parcel_id)
    encumbrance = departments_service.find_encumbrance_by_parcel(db, parcel_id)

    land_records = (
        adapt_land_records_result(land_records_result)
        if land_records_result and land_records_result != land_records_lookup_service.PARCEL_NOT_FOUND
        else None
    )

    envelope = build_canonical_envelope(
        parcel=parcel,
        survey_number=find_type("SURVEY_NUMBER"),
        plot_number=find_type("PLOT_NUMBER"),
        local_identifier=find_type("LOCAL_PARCEL_ID"),
        locality=land_records.locality if land_records else parcel.local_body_code,
        source_availability={
            "LAND_RECORDS": land_records is not None,
            "REGISTRATION": registration is not None,
            "PLANNING": planning is not None,
            "TAX": tax is not None,
            "RESTRICTION": restriction is not None,
            "DISPUTE": dispute is not None,
            "ENCUMBRANCE": encumbrance is not None,
        },
    )

    return {
        **envelope,
        "cluster_id": parcel.cluster_id,
        "departments": {
            "land_records": land_records,
            "registration": registration,
            "planning": planning,
            "tax": tax,
            "restriction": restriction,
            "dispute": dispute,
            "encumbrance": encumbrance,
        },
    }
