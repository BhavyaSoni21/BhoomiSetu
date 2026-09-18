"""Change detection background tasks."""

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.processing_job import ProcessingJob
from sqlalchemy import func
from uuid import UUID


@celery_app.task(bind=True, max_retries=3, default_retry_delay=120)
def run_change_detection_analysis(self, job_id: str, aoi_geojson: dict, start_date: str, end_date: str, threshold: float = 0.3):
    """Run change detection analysis on satellite imagery."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        from app.services.change_detection_service import run_change_detection

        result = run_change_detection(aoi_geojson, start_date, end_date, threshold)

        job.status = "succeeded"
        job.result = result
        job.completed_at = func.now()
        db.commit()

        return result

    except Exception as exc:
        db.rollback()
        job = db.query(ProcessingJob).get(UUID(job_id))
        if job:
            job.status = "failed"
            job.error = str(exc)
            job.completed_at = func.now()
            db.commit()
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=2, default_retry_delay=60)
def schedule_periodic_change_detection(self, job_id: str, district: str, state_code: str, frequency_days: int = 30):
    """Schedule periodic change detection for a district."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        # This would typically create a periodic task or schedule future runs
        # For now, just record the configuration
        result = {"scheduled": True, "district": district, "state_code": state_code, "frequency_days": frequency_days}

        job.status = "succeeded"
        job.result = result
        job.completed_at = func.now()
        db.commit()

        return result

    except Exception as exc:
        db.rollback()
        job = db.query(ProcessingJob).get(UUID(job_id))
        if job:
            job.status = "failed"
            job.error = str(exc)
            job.completed_at = func.now()
            db.commit()
        raise self.retry(exc=exc)
    finally:
        db.close()