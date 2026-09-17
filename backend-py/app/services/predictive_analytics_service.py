"""Ported from backend/src/predictive-analytics/predictive-analytics.service.ts.

A transparent, hand-weighted heuristic - deliberately not a trained model
(docs/FEATURE_AUDIT.md §8 item 8 scopes "predictive analytics" this way;
this project has no labeled outcome data - real disputes/defaults tied to
real prior parcel states - to train or validate one against). Every
factor carries its own plain-language rationale alongside the number
specifically so a score is defensible/auditable rather than a black box:
an officer or citizen can see exactly which real records produced it.

Weights (tax 0.4 / dispute 0.3 / alerts 0.2 / restriction 0.1) rank the
factors by how directly each threatens continued, undisputed ownership -
tax delinquency is the most common and mechanical precursor to state
action, an active dispute directly contests title, an open governance
alert is a flagged-but-not-yet-adjudicated concern, and a standing
land-use restriction is a slower-moving constraint. A missing department
record for a parcel (~most parcels only match a subset of the five mock
departments - see scripts/seed.py) excludes that factor from the weighted
average entirely rather than silently scoring it 0, so coverage gaps
don't dilute a score relative to an equally-risky parcel that simply has
more data.
"""

from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.department_record import DisputeRecord, RestrictionRecord, TaxRecord
from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel

# Ownership/encroachment disputes threaten who holds title or the parcel's
# physical extent; boundary/inheritance disputes are typically narrower in
# scope - reflected as a severity ordering, not an arbitrary ranking.
_DISPUTE_TYPE_SEVERITY = {"OWNERSHIP": 90, "ENCROACHMENT": 80, "BOUNDARY": 65, "INHERITANCE": 55}
_ALERT_SEVERITY_SCORE = {"CRITICAL": 100, "HIGH": 70, "MEDIUM": 40, "LOW": 15}
_RESTRICTION_TYPE_SEVERITY = {"FLOOD_PRONE": 60, "PROTECTED_AREA": 55, "ENVIRONMENTAL": 50}


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _band_for(score: float) -> str:
    if score >= 75:
        return "CRITICAL"
    if score >= 50:
        return "HIGH"
    if score >= 25:
        return "MEDIUM"
    return "LOW"


@dataclass
class RiskFactorResult:
    key: str
    label: str
    weight: float
    available: bool
    score: float
    rationale: str


@dataclass
class RiskScoreResult:
    parcel_id: str
    overall_score: float
    risk_band: str
    data_completeness: float
    factors: list[RiskFactorResult] = field(default_factory=list)


def _score_tax_factor(tax: TaxRecord | None) -> RiskFactorResult:
    weight = 0.4
    label = "Tax Delinquency"
    if tax is None:
        return RiskFactorResult("TAX_DELINQUENCY", label, weight, False, 0, "No tax record on file for this parcel.")

    assessed_value = float(tax.assessed_value)
    outstanding_amount = float(tax.outstanding_amount)

    if tax.tax_status == "OVERDUE":
        ratio = outstanding_amount / assessed_value if assessed_value > 0 else 0
        bonus = _clamp(ratio * 400, 0, 40)
        score = round(_clamp(60 + bonus, 0, 100))
        rationale = f"Tax status is OVERDUE with ₹{outstanding_amount:,.0f} outstanding ({ratio * 100:.1f}% of assessed value)."
    elif tax.tax_status == "PENDING":
        score = 25
        rationale = "Tax status is PENDING (payment cycle in progress, not yet overdue)."
    else:
        score = 0
        rationale = "Tax status is PAID."
    return RiskFactorResult("TAX_DELINQUENCY", label, weight, True, score, rationale)


def _score_dispute_factor(dispute: DisputeRecord | None) -> RiskFactorResult:
    weight = 0.3
    label = "Dispute Exposure"
    if dispute is None:
        return RiskFactorResult("ACTIVE_DISPUTE", label, weight, False, 0, "No dispute record on file for this parcel.")
    if dispute.has_active_dispute and dispute.dispute_type:
        score = _DISPUTE_TYPE_SEVERITY.get(dispute.dispute_type, 60)
        status_label = (dispute.case_status or "open").lower().replace("_", " ")
        rationale = f"An active {dispute.dispute_type.lower()} dispute is {status_label}."
        return RiskFactorResult("ACTIVE_DISPUTE", label, weight, True, score, rationale)
    rationale = f"Prior dispute is {dispute.case_status.lower()}; no active dispute." if dispute.case_status else "No active dispute."
    return RiskFactorResult("ACTIVE_DISPUTE", label, weight, True, 0, rationale)


def _score_alert_factor(open_alerts: list[GovernanceAlert]) -> RiskFactorResult:
    weight = 0.2
    label = "Open Governance Alerts"
    if not open_alerts:
        return RiskFactorResult("GOVERNANCE_ALERTS", label, weight, True, 0, "No open governance alerts.")
    worst = max(open_alerts, key=lambda a: _ALERT_SEVERITY_SCORE.get(a.severity, 0))
    score = _ALERT_SEVERITY_SCORE.get(worst.severity, 0)
    rationale = f"{len(open_alerts)} open alert(s); most severe is {worst.severity} ({worst.alert_type.replace('_', ' ').lower()})."
    return RiskFactorResult("GOVERNANCE_ALERTS", label, weight, True, score, rationale)


def _score_restriction_factor(restriction: RestrictionRecord | None) -> RiskFactorResult:
    weight = 0.1
    label = "Land-Use Restriction"
    if restriction is None:
        return RiskFactorResult("RESTRICTION", label, weight, False, 0, "No restriction record on file for this parcel.")
    if restriction.has_restriction:
        score = _RESTRICTION_TYPE_SEVERITY.get(restriction.restriction_type, 45) if restriction.restriction_type else 45
        type_label = (restriction.restriction_type or "RESTRICTION").lower().replace("_", " ")
        rationale = f"Flagged {type_label} by {restriction.imposing_authority or 'an unspecified authority'}."
        return RiskFactorResult("RESTRICTION", label, weight, True, score, rationale)
    return RiskFactorResult("RESTRICTION", label, weight, True, 0, "No restriction on file.")


def _combine(factors: list[RiskFactorResult]) -> tuple[float, str, float]:
    total_weight = sum(f.weight for f in factors)
    available = [f for f in factors if f.available]
    available_weight = sum(f.weight for f in available)

    if available_weight == 0:
        return 0, "LOW", 0

    weighted_sum = sum(f.score * f.weight for f in available)
    overall_score = round(weighted_sum / available_weight)
    return overall_score, _band_for(overall_score), round((available_weight / total_weight), 2)


def _build_result(
    parcel_id: str,
    tax: TaxRecord | None,
    dispute: DisputeRecord | None,
    restriction: RestrictionRecord | None,
    open_alerts: list[GovernanceAlert],
) -> RiskScoreResult:
    factors = [
        _score_tax_factor(tax),
        _score_dispute_factor(dispute),
        _score_alert_factor(open_alerts),
        _score_restriction_factor(restriction),
    ]
    overall_score, risk_band, data_completeness = _combine(factors)
    return RiskScoreResult(parcel_id, overall_score, risk_band, data_completeness, factors)


def get_risk_score(db: Session, parcel_id: str) -> RiskScoreResult | None:
    parcel = db.get(Parcel, parcel_id)
    if parcel is None:
        return None

    tax = db.scalars(select(TaxRecord).where(TaxRecord.parcel_id == parcel_id)).first()
    dispute = db.scalars(select(DisputeRecord).where(DisputeRecord.parcel_id == parcel_id)).first()
    restriction = db.scalars(select(RestrictionRecord).where(RestrictionRecord.parcel_id == parcel_id)).first()
    open_alerts = list(db.scalars(select(GovernanceAlert).where(GovernanceAlert.parcel_id == parcel_id, GovernanceAlert.status == "OPEN")).all())

    return _build_result(parcel_id, tax, dispute, restriction, open_alerts)


def get_top_risk_parcels(db: Session, limit: int | None = None) -> list[RiskScoreResult]:
    capped_limit = int(_clamp(int(limit) if limit else 10, 1, 100))

    parcels = list(db.scalars(select(Parcel)).all())
    tax_records = list(db.scalars(select(TaxRecord)).all())
    dispute_records = list(db.scalars(select(DisputeRecord)).all())
    restriction_records = list(db.scalars(select(RestrictionRecord)).all())
    open_alerts = list(db.scalars(select(GovernanceAlert).where(GovernanceAlert.status == "OPEN")).all())

    tax_by_parcel = {r.parcel_id: r for r in tax_records}
    dispute_by_parcel = {r.parcel_id: r for r in dispute_records}
    restriction_by_parcel = {r.parcel_id: r for r in restriction_records}
    alerts_by_parcel: dict[str, list[GovernanceAlert]] = {}
    for alert in open_alerts:
        alerts_by_parcel.setdefault(alert.parcel_id, []).append(alert)

    scored = [
        _build_result(
            str(parcel.id),
            tax_by_parcel.get(str(parcel.id)),
            dispute_by_parcel.get(str(parcel.id)),
            restriction_by_parcel.get(str(parcel.id)),
            alerts_by_parcel.get(str(parcel.id), []),
        )
        for parcel in parcels
    ]

    scored.sort(key=lambda r: r.overall_score, reverse=True)
    return scored[:capped_limit]
