"""Ported from backend/src/interoperability/response-aggregator.service.ts.

Tech.md #22's "RESPONSE AGGREGATION" stage: calls every department
lookup, runs the Land Records result through the State A/B adapter,
transforms everything into the canonical envelope, and merges in the raw
per-department payloads so Parcel 360 is genuinely useful (not just a
pointer saying data exists). This is what GET /api/v1/parcels/:id/360
calls - see app/routers/parcels.py.
"""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.common.canonical_transformer import build_canonical_envelope
from app.common.land_record_adapters import adapt_land_records_result
from app.models.parcel import OwnershipHistoryRecord, Parcel, ParcelIdentifier
from app.models.spatial import ZoningOverlay
from app.services import departments_service, land_records_lookup_service


def _norm_name(name: str) -> str:
    return " ".join(name.lower().replace(".", " ").split())


def _names_conflict(a: str | None, b: str | None) -> bool:
    """True when two owner names disagree after light normalization (case,
    spacing, dots). A differing token set — including "Ramesh Patil" vs
    "Ramesh Kumar Patil" — counts; an exact match after normalizing does not.
    ponytail: token-set compare, not fuzzy/phonetic; swap in a real name
    matcher if false positives on genuine spelling variants matter."""
    if not a or not b:
        return False
    na, nb = _norm_name(a), _norm_name(b)
    return bool(na and nb and na != nb and set(na.split()) != set(nb.split()))


def _detect_conflicts(*, land_records, tax, survey, dispute, encumbrance, ownership_owner) -> list[dict]:
    """Cross-department discrepancies for one parcel, computed from the
    already-fetched source records — the Parcel-360 "why this needs a case"
    band. Each entry: {type, severity, sources, message}."""
    conflicts: list[dict] = []

    # Owner name: canonical land record vs the most recent ownership-chain entry.
    if land_records and _names_conflict(getattr(land_records, "owner_name", None), ownership_owner):
        conflicts.append({
            "type": "OWNER_NAME_MISMATCH", "severity": "MEDIUM",
            "sources": ["LAND_RECORDS", "REGISTRATION"],
            "message": (
                f'Owner name differs between land records ("{land_records.owner_name}") '
                f'and the registered ownership chain ("{ownership_owner}").'
            ),
            "values": {"LAND_RECORDS": land_records.owner_name, "REGISTRATION": ownership_owner},
        })

    # Area: state-schema recorded area vs field-surveyed area (both in m²).
    if land_records and survey and survey.measured_area_sq_m is not None:
        recorded = float(land_records.area_sq_m)
        measured = float(survey.measured_area_sq_m)
        if recorded > 0 and abs(measured - recorded) / recorded > 0.03:
            conflicts.append({
                "type": "AREA_MISMATCH", "severity": "HIGH",
                "sources": ["LAND_RECORDS", "SURVEY"],
                "message": (
                    f"Recorded area {recorded:,.0f} m² differs from the field-surveyed "
                    f"area {measured:,.0f} m² by {abs(measured - recorded) / recorded * 100:.0f}%."
                ),
                "values": {"LAND_RECORDS": recorded, "SURVEY": measured},
            })

    if tax and tax.tax_status == "OVERDUE":
        outstanding = float(tax.outstanding_amount or 0)
        conflicts.append({
            "type": "TAX_OVERDUE", "severity": "MEDIUM", "sources": ["TAX"],
            "message": "Property tax is overdue"
            + (f" (₹{outstanding:,.0f} outstanding)." if outstanding else "."),
        })

    if dispute and dispute.has_active_dispute:
        conflicts.append({
            "type": "ACTIVE_DISPUTE", "severity": "HIGH", "sources": ["DISPUTE"],
            "message": f"An active {(dispute.dispute_type or 'OWNERSHIP').lower()} dispute is on record for this parcel.",
        })

    # Fraud cross-check: an encumbrance registered against disputed land.
    if encumbrance and encumbrance.has_encumbrance and dispute and dispute.has_active_dispute:
        conflicts.append({
            "type": "ENCUMBRANCE_ON_DISPUTED", "severity": "CRITICAL",
            "sources": ["ENCUMBRANCE", "DISPUTE"],
            "message": "An active encumbrance is registered against a parcel that also has an active dispute.",
        })

    return conflicts


def _resolve_zone_membership(db: Session, parcel: Parcel) -> dict | None:
    """Which zoning overlay this parcel geometrically falls in, by greatest
    area overlap (PostGIS), not the stored PlanningRecord text label. Ratio
    is intersection_area / parcel_area; both areas are in the same (degree)
    units so the ratio is unit-independent.
    """
    row = (
        db.query(
            ZoningOverlay.id,
            ZoningOverlay.name,
            ZoningOverlay.zone_type,
            func.ST_Area(func.ST_Intersection(ZoningOverlay.geometry, Parcel.geometry)).label("inter_area"),
            func.ST_Area(Parcel.geometry).label("parcel_area"),
        )
        .join(Parcel, Parcel.id == parcel.id)
        .filter(func.ST_Intersects(ZoningOverlay.geometry, Parcel.geometry))
        .order_by(func.ST_Area(func.ST_Intersection(ZoningOverlay.geometry, Parcel.geometry)).desc())
        .first()
    )
    if row is None or not row.parcel_area:
        return None
    return {
        "zoneId": str(row.id),
        "zoneType": row.zone_type,
        "name": row.name,
        "overlapPct": round(float(row.inter_area) / float(row.parcel_area) * 100, 1),
    }


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
    survey = departments_service.find_survey_by_parcel(db, parcel_id)

    ownership_owner = db.scalars(
        select(OwnershipHistoryRecord.owner_name)
        .where(OwnershipHistoryRecord.parcel_id == parcel_id)
        .order_by(OwnershipHistoryRecord.transaction_date.desc())
    ).first()

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
            "SURVEY": survey is not None,
        },
    )

    return {
        **envelope,
        "cluster_id": parcel.cluster_id,
        "zone_membership": _resolve_zone_membership(db, parcel),
        "conflicts": _detect_conflicts(
            land_records=land_records, tax=tax, survey=survey, dispute=dispute,
            encumbrance=encumbrance, ownership_owner=ownership_owner,
        ),
        "departments": {
            "land_records": land_records,
            "registration": registration,
            "planning": planning,
            "tax": tax,
            "restriction": restriction,
            "dispute": dispute,
            "encumbrance": encumbrance,
            "survey": survey,
        },
    }
