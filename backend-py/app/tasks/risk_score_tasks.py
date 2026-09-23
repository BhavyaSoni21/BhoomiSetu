"""Celery tasks for Composite Risk Score layer (NEW_MAP_LAYERS_PLAN.md Layer 4).

Two tasks:
  - recompute_risk_score: per-parcel, event-driven. Triggered on any
    dispute, encumbrance, tax, or governance alert change for that parcel.
  - recompute_all_risk_scores: nightly full sweep. Idempotent bulk calculation
    matching predictive_analytics_service scoring heuristic.

Score heuristic (0.0 to 100.0):
  - Tax Delinquency: 0.4
  - Dispute Exposure: 0.3
  - Open Governance Alerts: 0.2
  - Standing Land-Use Restriction: 0.1
"""
import logging

try:
    from celery import shared_task
except ImportError:
    def shared_task(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

from sqlalchemy import bindparam as sa_bindparam, select, update
from sqlalchemy.orm import Session

from app.core.celery_app import celery_app  # noqa: F401
from app.database import SessionLocal
from app.models.department_record import DisputeRecord, RestrictionRecord, TaxRecord
from app.models.governance import GovernanceAlert
from app.models.parcel import Parcel
from app.services.predictive_analytics_service import (
    _build_result,
    get_risk_score,
)

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def recompute_risk_score(self, parcel_id: str) -> dict:
    """Recompute risk_score for a single parcel and update parcel.risk_score."""
    db: Session = SessionLocal()
    try:
        result = get_risk_score(db, str(parcel_id))
        if result is None:
            logger.warning("recompute_risk_score: parcel %s not found", parcel_id)
            return {"parcel_id": parcel_id, "risk_score": 0.0}

        score = float(result.overall_score)
        db.execute(
            update(Parcel)
            .where(Parcel.id == parcel_id)
            .values(risk_score=score)
        )
        db.commit()
        logger.info("recompute_risk_score(%s) -> %.2f (%s)", parcel_id, score, result.risk_band)
        return {"parcel_id": parcel_id, "risk_score": score, "risk_band": result.risk_band}
    except Exception as exc:
        db.rollback()
        logger.exception("recompute_risk_score(%s) failed", parcel_id)
        raise self.retry(exc=exc)
    finally:
        db.close()


@shared_task
def recompute_all_risk_scores() -> dict:
    """Nightly full sweep: compute and store risk_score for all parcels."""
    db: Session = SessionLocal()
    try:
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

        updates = []
        for parcel in parcels:
            pid = str(parcel.id)
            scored = _build_result(
                pid,
                tax_by_parcel.get(pid),
                dispute_by_parcel.get(pid),
                restriction_by_parcel.get(pid),
                alerts_by_parcel.get(pid, []),
            )
            updates.append({"b_id": parcel.id, "b_score": float(scored.overall_score)})

        if updates:
            # Batch update in chunks of 1000
            chunk_size = 1000
            for i in range(0, len(updates), chunk_size):
                chunk = updates[i:i + chunk_size]
                db.execute(
                    update(Parcel)
                    .where(Parcel.id == sa_bindparam("b_id"))
                    .values(risk_score=sa_bindparam("b_score")),
                    chunk,
                )
            db.commit()

        logger.info("recompute_all_risk_scores: successfully updated %d parcels", len(updates))
        return {"updated": len(updates)}
    except Exception:
        db.rollback()
        logger.exception("recompute_all_risk_scores failed")
        raise
    finally:
        db.close()
