"""Earth Engine background tasks."""

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.processing_job import ProcessingJob
from sqlalchemy import func
from uuid import UUID


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_change_detection(self, job_id: str, aoi_geojson: dict, start_date: str, end_date: str):
    """Process change detection for an area of interest."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        # Import here to avoid circular imports
        from app.services.earth_engine_service import run_change_detection

        result = run_change_detection(aoi_geojson, start_date, end_date)

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


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def fetch_historical_imagery(self, job_id: str, aoi_geojson: dict, year: int):
    """Fetch historical satellite imagery for a given year."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        from app.services.earth_engine_service import get_historical_imagery

        result = get_historical_imagery(aoi_geojson, year)

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