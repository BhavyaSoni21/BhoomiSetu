"""OCR background tasks."""

from app.core.celery_app import celery_app
from app.database import SessionLocal
from app.models.processing_job import ProcessingJob
from sqlalchemy import func
from uuid import UUID


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def process_document_ocr(self, job_id: str, file_path: str, document_type: str):
    """Process OCR on a document."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        from app.document_verification.ocr import extract_text_from_image

        result = extract_text_from_image(file_path, document_type)

        job.status = "succeeded"
        job.result = {"extracted_text": result}
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


@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def batch_ocr_processing(self, job_id: str, file_paths: list[str], document_type: str):
    """Process multiple documents with OCR."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).get(UUID(job_id))
        if not job:
            return {"error": "Job not found"}

        job.status = "running"
        job.started_at = func.now()
        db.commit()

        from app.document_verification.ocr import extract_text_from_image

        results = []
        for file_path in file_paths:
            text = extract_text_from_image(file_path, document_type)
            results.append({"file": file_path, "text": text})

        job.status = "succeeded"
        job.result = {"results": results}
        job.completed_at = func.now()
        db.commit()

        return results

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