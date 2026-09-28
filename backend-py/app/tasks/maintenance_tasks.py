"""Periodic maintenance tasks (DEP-01)."""

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.services.job_reaper import reap_stuck_jobs


@celery_app.task
def reap_stuck_jobs_task():
    """Beat-scheduled sweep of stuck jobs. See app.services.job_reaper."""
    db = SessionLocal()
    try:
        reaped = reap_stuck_jobs(db)
        db.commit()
        return {"reaped": reaped}
    finally:
        db.close()
