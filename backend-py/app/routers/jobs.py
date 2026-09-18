"""Background jobs API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime

from app.auth.deps import require_roles
from app.database import get_db
from app.models.user import User
from app.models.processing_job import ProcessingJob
from app.schemas.profile_field import DynamicProfileData

router = APIRouter(prefix="/jobs", tags=["jobs"])


class JobCreate(DynamicProfileData):
    job_type: str
    payload: dict
    idempotency_key: str | None = None


class JobResponse(DynamicProfileData):
    id: UUID
    job_type: str
    payload: dict
    status: str
    result: dict | None
    error: str | None
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    idempotency_key: str | None

    class Config:
        from_attributes = True


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job(data: JobCreate, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    """Create a new background job."""
    # Check idempotency
    if data.idempotency_key:
        existing = db.query(ProcessingJob).filter_by(idempotency_key=data.idempotency_key).first()
        if existing:
            return JobResponse.model_validate(existing)

    job = ProcessingJob(
        job_type=data.job_type,
        payload=data.payload,
        idempotency_key=data.idempotency_key,
    )
    db.add(job)
    db.flush()

    # Dispatch to Celery based on job type
    from app.core.celery_app import celery_app

    if data.job_type == "change_detection":
        from app.tasks.change_detection_tasks import run_change_detection_analysis
        run_change_detection_analysis.delay(str(job.id), **data.payload)
    elif data.job_type == "earth_engine_change_detection":
        from app.tasks.earth_engine_tasks import process_change_detection
        process_change_detection.delay(str(job.id), **data.payload)
    elif data.job_type == "earth_engine_historical":
        from app.tasks.earth_engine_tasks import fetch_historical_imagery
        fetch_historical_imagery.delay(str(job.id), **data.payload)
    elif data.job_type == "ocr":
        from app.tasks.ocr_tasks import process_document_ocr
        process_document_ocr.delay(str(job.id), **data.payload)
    elif data.job_type == "etl":
        from app.tasks.etl_tasks import run_etl_pipeline
        run_etl_pipeline.delay(str(job.id), **data.payload)
    elif data.job_type == "import_parcels":
        from app.tasks.etl_tasks import import_parcel_data
        import_parcel_data.delay(str(job.id), **data.payload)

    return JobResponse.model_validate(job)


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: UUID, db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    """Get job status and result."""
    job = db.get(ProcessingJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)


@router.get("", response_model=list[JobResponse])
def list_jobs(
    status: str | None = None,
    job_type: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_roles("ADMIN")),
):
    """List jobs with optional filters."""
    query = db.query(ProcessingJob)
    if status:
        query = query.filter(ProcessingJob.status == status)
    if job_type:
        query = query.filter(ProcessingJob.job_type == job_type)
    query = query.order_by(ProcessingJob.created_at.desc()).limit(limit).offset(offset)
    return [JobResponse.model_validate(j) for j in query.all()]