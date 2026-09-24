"""Idempotency ledger for offline-sync operations (spec §8).

Mirrors the ``ProcessingJob.idempotency_key`` pattern: the client-generated
``operation_id`` is unique, so replaying a batch after a dropped response
returns the stored result instead of applying the mutation twice.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, Text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProcessedSyncOperation(Base):
    __tablename__ = "processed_sync_operations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    operation_id: Mapped[str] = mapped_column(String(64), unique=True)  # client uuid — idempotency key
    owner_user_id: Mapped[str] = mapped_column(String(64), index=True)
    entity_type: Mapped[str] = mapped_column(String(20))  # case | document | evidence
    status: Mapped[str] = mapped_column(String(20))       # APPLIED | CONFLICT | REJECTED
    entity_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    result: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # prior response, replayed on retry
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_created_at: Mapped[datetime | None] = mapped_column(nullable=True)
    server_received_at: Mapped[datetime] = mapped_column(server_default=func.now())
