"""A Verifier's field-visit evidence - geotagged photo + timestamp + notes.

Two usages:
  1. Linked to a *Workflow* (legacy old-model usage via workflows_service):
     the verifier captures evidence against a workflow step.
  2. Linked to a *Case* + DepartmentTask (Phase 5 unified workflow): via
     case_service.capture_evidence() — evidence_id prefixed ``EVID-`` for
     human-readable reference, plus GPS coordinates, accuracy, photo hash,
     sequence number, and the verifier's field findings submission.

Distinct from Workflow.evidence_* (a citizen's own document attached at
filing time) and from ParcelDocument (a parcel's official land-record
paperwork): this is specifically what an Authorized Field Verifier captured
on-site, reviewed by staff before a workflow step / task is decided.
"""

import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VerificationEvidence(Base):
    __tablename__ = "verification_evidence"
    __table_args__ = (
        Index("ix_verification_evidence_workflow_id", "workflow_id"),
        Index("ix_verification_evidence_case_id", "case_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Legacy link to the old Workflow model (kept nullable for backward
    # compatibility with existing workflows_service.py queries).
    workflow_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("workflows.id", ondelete="CASCADE"), nullable=True)

    # New-model link: evidence captured under the unified case workflow.
    # Nullable so old workflow-based evidence rows remain valid.
    case_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), nullable=True, index=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)

    # Human-readable evidence ID, e.g. EVID-2026-00042
    evidence_id: Mapped[str] = mapped_column(String(30), unique=True, index=True)

    # String, not a real FK - matches Workflow.citizen_id's existing
    # convention for cross-entity references in this codebase.
    verifier_id: Mapped[str] = mapped_column(String)

    # For evidence submitted without a photo, photo fields stay nullable.
    photo_file_name: Mapped[str | None] = mapped_column(String, nullable=True)
    photo_file_path: Mapped[str | None] = mapped_column(String, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(40), nullable=True)

    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Client-reported capture time - when the photo/GPS was actually taken on
    # site, which may differ from created_at (server receipt time) if the
    # upload happens moments later.
    captured_at: Mapped[datetime] = mapped_column()

    # Optional photo hash for deduplication / integrity (§31)
    photo_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sequence: Mapped[int | None] = mapped_column(Integer, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
