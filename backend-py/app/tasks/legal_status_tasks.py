"""Celery tasks for the Legal Status map layer (NEW_MAP_LAYERS_PLAN.md Layer 1).

Two tasks:
  - recompute_legal_status_severity: per-parcel, event-driven. Call this
    whenever a DisputeRecord or EncumbranceRecord is created or updated for
    a parcel so the tile attribute stays near-real-time.
  - recompute_all_legal_status_severities: nightly full-sweep. Idempotent.
    Ensures no row silently goes stale if an event-driven call is missed.

Severity scale (matches NEW_MAP_LAYERS_PLAN.md and the frontend legend):
  0 = clear      – no active dispute, no active encumbrance
  1 = encumbered – active mortgage/lien/charge (no discharge date)
  2 = disputed (low)  – BOUNDARY or INHERITANCE dispute type
  3 = disputed (high) – OWNERSHIP or ENCROACHMENT dispute type

Cross-cutting rule (§ plan rule 3): severity is computed once, stored in a
plain column, never re-derived inside a tile request.
"""
import logging

try:
    from celery import shared_task
except ImportError:
    def shared_task(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

from sqlalchemy import text

from app.core.celery_app import celery_app  # noqa: F401 – ensures app is configured
from app.database import SessionLocal

logger = logging.getLogger(__name__)

# Dispute types that carry HIGH severity (score 3). Everything else that has
# an active dispute is LOW severity (score 2). This is intentionally a small
# list so it's easy to extend without touching the task signature.
_HIGH_SEVERITY_DISPUTE_TYPES = frozenset({"OWNERSHIP", "ENCROACHMENT"})


def _compute_severity_for_parcel(db, parcel_id: str) -> int:
    """Pure computation: derive severity integer from live department records.

    Runs inside a caller-provided session; does NOT commit.
    """
    # 1. Check for an active dispute (has_active_dispute=True, status is not
    #    RESOLVED or DISMISSED).  A dismissed/resolved dispute shouldn't keep
    #    coloring the parcel red.
    dispute = db.execute(
        text("""
            SELECT dispute_type, case_status
            FROM   dispute_records
            WHERE  parcel_id   = :parcel_id
              AND  has_active_dispute = TRUE
              AND  (case_status IS NULL
                    OR case_status NOT IN ('RESOLVED', 'DISMISSED'))
            LIMIT 1
        """),
        {"parcel_id": str(parcel_id)},
    ).fetchone()

    if dispute:
        dispute_type = (dispute.dispute_type or "").upper()
        if dispute_type in _HIGH_SEVERITY_DISPUTE_TYPES:
            return 3
        return 2

    # 2. Check for an active encumbrance (has_encumbrance=True and not
    #    discharged — discharge_date IS NULL means still active).
    encumbrance = db.execute(
        text("""
            SELECT id
            FROM   encumbrance_records
            WHERE  parcel_id       = :parcel_id
              AND  has_encumbrance = TRUE
              AND  discharge_date  IS NULL
            LIMIT 1
        """),
        {"parcel_id": str(parcel_id)},
    ).fetchone()

    if encumbrance:
        return 1

    return 0


@shared_task(name="legal_status.recompute_parcel", bind=True, max_retries=3, default_retry_delay=60)
def recompute_legal_status_severity(self, parcel_id: str) -> dict:
    """Recompute legal_status_severity for a single parcel.

    Call this from any write path that modifies DisputeRecord or
    EncumbranceRecord for a parcel (e.g. after saving a new dispute or
    encumbrance via the departments router).

    Returns a dict with parcel_id and the new severity value so callers
    can log or assert on it.
    """
    try:
        db = SessionLocal()
        try:
            severity = _compute_severity_for_parcel(db, parcel_id)
            db.execute(
                text(
                    "UPDATE parcels SET legal_status_severity = :severity "
                    "WHERE id::text = :parcel_id"
                ),
                {"severity": severity, "parcel_id": str(parcel_id)},
            )
            db.commit()
            logger.info("legal_status: parcel %s → severity %d", parcel_id, severity)
            return {"parcel_id": parcel_id, "severity": severity}
        finally:
            db.close()
    except Exception as exc:
        logger.exception("legal_status: failed for parcel %s: %s", parcel_id, exc)
        raise self.retry(exc=exc)


@shared_task(name="legal_status.recompute_all", bind=True)
def recompute_all_legal_status_severities(self) -> dict:
    """Nightly full-sweep: recompute legal_status_severity for every parcel.

    Idempotent — safe to re-run. Processes parcels in batches of 500 to
    avoid a single enormous transaction.  Uses a per-batch commit pattern
    (same convention as the existing terrain_tasks.py batch jobs) so a
    crash mid-sweep doesn't roll back partial progress.
    """
    db = SessionLocal()
    updated = 0
    errors = 0
    try:
        # Pull all parcel IDs once; severity computation is then per-row
        # with targeted reads from the department tables.  This is cheaper
        # than a single giant JOIN because the department tables are
        # indexed on parcel_id and the result set is small per parcel.
        rows = db.execute(text("SELECT id FROM parcels ORDER BY id")).fetchall()
        parcel_ids = [str(r.id) for r in rows]
    finally:
        db.close()

    BATCH = 500
    for i in range(0, len(parcel_ids), BATCH):
        batch = parcel_ids[i : i + BATCH]
        db = SessionLocal()
        try:
            for pid in batch:
                try:
                    severity = _compute_severity_for_parcel(db, pid)
                    db.execute(
                        text(
                            "UPDATE parcels SET legal_status_severity = :severity "
                            "WHERE id::text = :pid"
                        ),
                        {"severity": severity, "pid": pid},
                    )
                    updated += 1
                except Exception as exc:
                    logger.warning("legal_status sweep: error on %s: %s", pid, exc)
                    errors += 1
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.exception("legal_status sweep: batch commit failed: %s", exc)
            errors += len(batch)
        finally:
            db.close()

    logger.info(
        "legal_status sweep complete: %d updated, %d errors out of %d parcels",
        updated, errors, len(parcel_ids),
    )
    return {"updated": updated, "errors": errors, "total": len(parcel_ids)}
