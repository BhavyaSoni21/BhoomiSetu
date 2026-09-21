"""Ported from backend/src/historical-imagery/historical-comparison.service.ts.

"What's different between two years" is a plain, real data comparison -
each parcel's ParcelCategory (the exact same function the seed-time
renderer uses to color the snapshot) computed for both years; a parcel is
"affected" if its category differs. No pixel math, no bounding boxes, no
spatial intersection - the category IS the localization, since it's keyed
directly by parcel id. The LLM's job is narrower but more central: given
the real facts behind each affected parcel's category change (a real
DisputeRecord or a real ParcelHistoricalState restriction flip - never
invented), write one grounded, readable sentence per parcel. A failed/
unconfigured LLM call falls back to the same real facts, plainly phrased -
the output is never blocked by, or dependent on, the AI call.
"""

import json
from dataclasses import dataclass, field
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.common.geometry_json import geometry_to_geojson
from app.common.parcel_generation.parcel_category import CATEGORY_LABELS, CURRENT_YEAR, category_for
from app.models.department_record import DisputeRecord, RestrictionRecord
from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel, ParcelHistoricalState
from app.services import narrative_service
from app.services.governance_rules_service import evaluate_rules_and_create_alerts
from app.services.narrative_service import ParcelChangeFact

# Bounds the LLM call's per-request latency regardless of how many parcels
# a comparison actually affects.
_MAX_LLM_NARRATIVE_PARCELS = 20

# The demo snapshot archive is a fixed 2022-2026 arc (see parcel_category.
# CURRENT_YEAR) - every cluster that has parcels has ParcelHistoricalState
# rows for exactly these years, seeded up front rather than derived from
# any stored image (satellite imagery now comes from Google Earth Engine,
# not a seed-time rendered PNG per cluster/year).
SNAPSHOT_YEARS = [2022, 2023, 2024, 2025, CURRENT_YEAR]


@dataclass
class AffectedParcelResult:
    parcel_id: str
    canonical_parcel_id: str
    from_category: str
    to_category: str
    narrative: str
    alert_id: str | None


@dataclass
class HistoricalComparisonResult:
    cluster_id: str
    from_year: int
    to_year: int
    change_detected: bool
    affected_parcels: list[AffectedParcelResult] = field(default_factory=list)


@dataclass
class CategorizedParcel:
    id: str
    canonical_parcel_id: str | None
    ulpin: str | None
    state_code: str
    district_code: str
    local_body_code: str
    area_sq_m: float
    # A JSON *string*, not a nested object - matches Parcel.geometry's raw
    # opaque-string contract everywhere else in this codebase (see
    # app/schemas/parcel.py's ParcelOut docstring for why).
    geometry: str
    category: str


def list_clusters(db: Session, state: str | None = None, district: str | None = None) -> list[dict[str, Any]]:
    query = db.query(Parcel.cluster_id).filter(Parcel.cluster_id.isnot(None))
    if state:
        query = query.filter(Parcel.state_code == state)
    if district:
        query = query.filter(Parcel.district_code == district)
    
    cluster_ids = [row[0] for row in query.distinct().order_by(Parcel.cluster_id).all()]
    return [{"clusterId": cluster_id, "years": SNAPSHOT_YEARS} for cluster_id in cluster_ids]


def get_parcels_for_year(db: Session, cluster_id: str, year: int) -> list[CategorizedParcel]:
    """Real parcel geometry + a real ParcelCategory per parcel for one
    year - lets the frontend render an actual year's boundaries on the
    live map, colored the same way the seed-time snapshot PNG is.
    """
    parcels = db.query(Parcel).filter_by(cluster_id=cluster_id).all()
    if not parcels:
        return []
    parcel_ids = [p.id for p in parcels]

    historical_states = db.query(ParcelHistoricalState).filter(ParcelHistoricalState.parcel_id.in_([str(pid) for pid in parcel_ids]), ParcelHistoricalState.year == year).all()
    restriction_by_parcel = {s.parcel_id: s.restriction_status for s in historical_states}

    # Same "current year only" rule as compare() below - DisputeRecord has
    # no per-year history to draw on for any other year.
    dispute_by_parcel: dict[str, DisputeRecord] = {}
    if year == CURRENT_YEAR:
        disputes = db.query(DisputeRecord).filter(DisputeRecord.parcel_id.in_([str(pid) for pid in parcel_ids])).all()
        dispute_by_parcel = {d.parcel_id: d for d in disputes}

    result = []
    for parcel in parcels:
        dispute = dispute_by_parcel.get(str(parcel.id))
        category = category_for(
            restriction_by_parcel.get(str(parcel.id)),
            {"hasActiveDispute": dispute.has_active_dispute, "disputeType": dispute.dispute_type} if dispute else None,
        )
        result.append(
            CategorizedParcel(
                id=str(parcel.id), canonical_parcel_id=parcel.canonical_parcel_id, ulpin=parcel.ulpin,
                state_code=parcel.state_code, district_code=parcel.district_code, local_body_code=parcel.local_body_code,
                area_sq_m=float(parcel.area_sq_m), geometry=json.dumps(geometry_to_geojson(parcel.geometry)), category=category,
            )
        )
    return result


def _build_fact_sentence(from_category: str, to_category: str, dispute: DisputeRecord | None, to_year: int) -> str:
    if to_category.startswith("DISPUTE_") and dispute:
        filed = f", filed {dispute.filing_date}" if dispute.filing_date else ""
        return f"Dispute record on file: {CATEGORY_LABELS[to_category].lower()}, status {dispute.case_status}{filed}."
    if to_category == "RESTRICTED":
        return f"This parcel's recorded restriction status became RESTRICTED in {to_year}."
    if to_category == "NONE" and from_category != "NONE":
        return f"The {CATEGORY_LABELS[from_category].lower()} previously on file for this parcel is no longer active as of {to_year}."
    return f"This parcel's status changed from {CATEGORY_LABELS[from_category]} to {CATEGORY_LABELS[to_category]} by {to_year}."


def compare(db: Session, cluster_id: str, from_year: int, to_year: int) -> HistoricalComparisonResult:
    """Governance alerts must only ever come from the most recent
    year-over-year difference - this is the ONLY function that creates
    GovernanceAlert rows from historical comparison, so enforcing the year
    pair here (not just in the frontend's year picker) guarantees no
    other year pair can ever generate one, regardless of caller.
    """
    if from_year != CURRENT_YEAR - 1 or to_year != CURRENT_YEAR:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Comparisons that generate governance alerts must run from {CURRENT_YEAR - 1} to {CURRENT_YEAR}.",
        )

    parcels = db.query(Parcel).filter_by(cluster_id=cluster_id).all()
    if not parcels:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No cluster found: {cluster_id}")
    parcel_ids = [str(p.id) for p in parcels]

    historical_states = (
        db.query(ParcelHistoricalState)
        .filter(ParcelHistoricalState.parcel_id.in_(parcel_ids), ParcelHistoricalState.year.in_([from_year, to_year]))
        .all()
    )
    restriction_by_parcel_year: dict[str, dict[int, str | None]] = {}
    for state in historical_states:
        restriction_by_parcel_year.setdefault(state.parcel_id, {})[state.year] = state.restriction_status

    # DisputeRecord has no per-year history - only relevant when comparing
    # against CURRENT_YEAR, and only fetched then.
    needs_dispute = from_year == CURRENT_YEAR or to_year == CURRENT_YEAR
    dispute_by_parcel: dict[str, DisputeRecord] = {}
    if needs_dispute:
        disputes = db.query(DisputeRecord).filter(DisputeRecord.parcel_id.in_(parcel_ids)).all()
        dispute_by_parcel = {d.parcel_id: d for d in disputes}

    affected: list[dict[str, Any]] = []
    for parcel in parcels:
        pid = str(parcel.id)
        dispute = dispute_by_parcel.get(pid)
        by_year = restriction_by_parcel_year.get(pid, {})
        from_category = category_for(by_year.get(from_year), {"hasActiveDispute": dispute.has_active_dispute, "disputeType": dispute.dispute_type} if from_year == CURRENT_YEAR and dispute else None)
        to_category = category_for(by_year.get(to_year), {"hasActiveDispute": dispute.has_active_dispute, "disputeType": dispute.dispute_type} if to_year == CURRENT_YEAR and dispute else None)
        if from_category != to_category:
            affected.append({"parcel": parcel, "from_category": from_category, "to_category": to_category})

    if not affected:
        return HistoricalComparisonResult(cluster_id=cluster_id, from_year=from_year, to_year=to_year, change_detected=False)

    # Falls back to the real DB id when canonical_parcel_id is unset (the
    # column is nullable, though seed.py always populates it).
    def display_id(parcel: Parcel) -> str:
        return parcel.canonical_parcel_id or str(parcel.id)

    facts: dict[str, str] = {}
    for a in affected:
        pid = str(a["parcel"].id)
        facts[pid] = _build_fact_sentence(a["from_category"], a["to_category"], dispute_by_parcel.get(pid), to_year)

    # A failed/unconfigured LLM call shouldn't block the deterministic
    # part of this feature. Only asked to cover _MAX_LLM_NARRATIVE_PARCELS
    # of the affected parcels (disputes first, the more severe category).
    narratives: dict[str, str] = {}
    try:
        prioritized = sorted(affected, key=lambda a: a["to_category"].startswith("DISPUTE_"), reverse=True)
        change_facts = [
            ParcelChangeFact(
                canonical_parcel_id=display_id(a["parcel"]), from_category=a["from_category"], to_category=a["to_category"],
                facts=facts[str(a["parcel"].id)],
            )
            for a in prioritized[:_MAX_LLM_NARRATIVE_PARCELS]
        ]
        narratives = narrative_service.explain_parcel_changes(from_year, to_year, change_facts)
    except Exception:  # noqa: BLE001 - deliberately swallowed, see the module docstring
        pass

    # Newly-appearing (or worsened) categories on affected parcels that
    # currently ALSO have a real restriction get bumped to CRITICAL.
    restriction_records = db.query(RestrictionRecord).filter(RestrictionRecord.parcel_id.in_([str(a["parcel"].id) for a in affected])).all()
    has_current_restriction = {r.parcel_id: r.has_restriction for r in restriction_records}

    narrative_by_parcel_id: dict[str, str] = {}
    alert_id_by_parcel_id: dict[str, str] = {}

    for a in affected:
        pid = str(a["parcel"].id)
        narrative = narratives.get(display_id(a["parcel"]), facts[pid])
        narrative_by_parcel_id[pid] = narrative

        # Determine alert type based on category change
        is_dispute = a["to_category"].startswith("DISPUTE_")
        alert_type = "DISPUTE_DETECTED" if is_dispute else "RESTRICTION_DETECTED"

        # Use governance rules to create alerts (admin-editable)
        created_alerts = evaluate_rules_and_create_alerts(
            db,
            alert_type=alert_type,
            parcel_id=pid,
            context={
                "from_category": a["from_category"],
                "to_category": a["to_category"],
                "has_current_restriction": has_current_restriction.get(pid, False),
                "parcel_id": pid,
                "narrative": narrative,
            },
        )
        if created_alerts:
            alert_id_by_parcel_id[pid] = str(created_alerts[0].id)

    affected_parcels = [
        AffectedParcelResult(
            parcel_id=str(a["parcel"].id), canonical_parcel_id=display_id(a["parcel"]),
            from_category=a["from_category"], to_category=a["to_category"],
            narrative=narrative_by_parcel_id[str(a["parcel"].id)],
            alert_id=alert_id_by_parcel_id.get(str(a["parcel"].id)),
        )
        for a in affected
    ]

    return HistoricalComparisonResult(cluster_id=cluster_id, from_year=from_year, to_year=to_year, change_detected=True, affected_parcels=affected_parcels)
