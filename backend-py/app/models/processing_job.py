"""Processing job model for background task tracking."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Text, func, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProcessingJob(Base):
    """Background job tracking - stores status, payload, result for Celery tasks."""

    __tablename__ = "processing_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_type: Mapped[str] = mapped_column(String(50))  # earth_engine, ocr, etl, change_detection
    payload: Mapped[dict] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued, running, succeeded, failed
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    idempotency_key: Mapped[str | None] = mapped_column(String(100), unique=True, nullable=True)
    dataset_status: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    total_estimated_eecu: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)
    actual_eecu: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)