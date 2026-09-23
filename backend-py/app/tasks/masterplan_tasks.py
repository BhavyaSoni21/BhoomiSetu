"""Celery tasks for Master Plan Mismatch (Layer 5)"""
import logging
import uuid
try:
    from celery import shared_task
except ImportError:
    # No celery in this environment: return the function with a no-op .delay /
    # .apply_async so callers (e.g. spatial.py) can fire-and-forget without a
    # broker. The recompute just doesn't run async here.
    def shared_task(*args, **kwargs):
        def decorator(fn):
            fn.delay = lambda *a, **k: None
            fn.apply_async = lambda *a, **k: None
            return fn
        return decorator

from sqlalchemy import text
from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.governance import GovernanceAlert

logger = logging.getLogger(__name__)

@shared_task(name="masterplan.recompute_all", bind=True)
def recompute_all_masterplan_mismatches(self):
    db = SessionLocal()
    try:
        # Reset all
        db.execute(text("UPDATE parcels SET masterplan_mismatch = FALSE"))
        
        # Find mismatched overlays
        mismatched_overlays = db.execute(text("""
            SELECT parcel_ids, zone_type, proposed_land_use, proposed_effective_year 
            FROM zoning_overlays
            WHERE proposed_land_use IS NOT NULL 
            AND proposed_land_use != zone_type
            AND parcel_ids IS NOT NULL
        """)).fetchall()

        mismatched_parcel_ids = set()
        alerts_to_create = []
        
        # Find which parcels already have an open alert
        existing_alerts = db.execute(text("""
            SELECT parcel_id FROM governance_alerts
            WHERE alert_type = 'MASTERPLAN_MISMATCH'
            AND status NOT IN ('RESOLVED', 'DISMISSED')
        """)).fetchall()
        existing_alert_pids = {r.parcel_id for r in existing_alerts}
        
        for row in mismatched_overlays:
            if not row.parcel_ids:
                continue
            for pid in row.parcel_ids:
                mismatched_parcel_ids.add(pid)
                if pid not in existing_alert_pids:
                    # New mismatch detected
                    alerts_to_create.append(GovernanceAlert(
                        parcel_id=pid,
                        alert_type="MASTERPLAN_MISMATCH",
                        severity="LOW",
                        source="ZONING_MONITOR",
                        explanation=f"Master plan mismatch: current use is {row.zone_type}, but proposed future use is {row.proposed_land_use} (effective {row.proposed_effective_year or 'TBD'})."
                    ))
                    existing_alert_pids.add(pid) # prevent duplicate alerts if overlapping
                
        if mismatched_parcel_ids:
            # Update parcels
            db.execute(text("""
                UPDATE parcels SET masterplan_mismatch = TRUE
                WHERE id::text = ANY(:pids)
            """), {"pids": list(mismatched_parcel_ids)})
            
        if alerts_to_create:
            db.add_all(alerts_to_create)
            
        db.commit()
        logger.info("masterplan recompute complete. Flagged %d parcels, created %d alerts.", len(mismatched_parcel_ids), len(alerts_to_create))
    except Exception as exc:
        db.rollback()
        logger.exception("masterplan recompute failed: %s", exc)
    finally:
        db.close()

