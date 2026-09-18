"""ETL background tasks."""

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.processing_job import ProcessingJob
from sqlalchemy import func
from uuid import UUID


@celery_app.task(bind=True, max_retries=2, default_retry_delay=120)
def run_etl_pipeline(self, job_id: str, source_config: dict, target_config: dict):
    """Run an ETL pipeline."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        # Placeholder for actual ETL logic
        # This would extract from source, transform, load to target
        result = {"records_processed": 0, "status": "completed"}

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


@celery_app.task(bind=True, max_retries=1, default_retry_delay=60)
def import_parcel_data(self, job_id: str, file_path: str, state_code: str, district_code: str):
    """Import parcel data from file (CSV/GeoJSON)."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        # Placeholder for actual import logic
        result = {"parcels_imported": 0, "errors": []}

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