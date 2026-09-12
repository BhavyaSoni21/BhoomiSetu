"""Ported from backend/src/workflows/workflow.entity.ts +
workflow-step.entity.ts.

backend-py is Postgres-only (no SQLite driver), so WorkflowStep's
completed_at - a 'datetime'/'timestamp' driver-specific column in the TS
entity - is always plain DateTime here.
"""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Workflow(Base):
    """A citizen service request, e.g. "request a copy of the RoR" or
    "correction request". `parcel_id` is a plain string, not a relation,
    consistent with the department records pattern elsewhere.
    """

    __tablename__ = "workflows"
    __table_args__ = (Index("ix_workflows_parcel_id", "parcel_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String)
    workflow_type: Mapped[str] = mapped_column(String(40))  # e.g. ROR_COPY_REQUEST | CORRECTION_REQUEST
    current_status: Mapped[str] = mapped_column(String(20), default="SUBMITTED")  # SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | COMPLETED
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    request_details: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Set only when RequestRoutingService's AI call successfully chose this
    # workflow's pipeline (as opposed to the deterministic pipeline_for()
    # fallback) - the AI's own one-sentence rationale, shown to the
    # assigned officer(s) so they see *why* this request landed in their
    # queue.
    routing_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # The citizen who filed this request, set once at creation. Needed
    # specifically for LAND_CLAIM_REQUEST - unlike every other workflow
    # type, a claim has no citizen_parcels link yet at filing time, so
    # notify_citizen_of_step_decision/review_step's claim-approval hook
    # can't resolve "which citizen" via that join the way every other
    # workflow can. Replaces that join-based lookup for every workflow
    # type going forward.
    citizen_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # Snapshotted from the citizen's profile at creation (never citizen-
    # entered) so the reviewing officer has everything needed to decide
    # without a separate profile lookup per request. created_by already
    # covers name.
    applicant_contact: Mapped[str | None] = mapped_column(String, nullable=True)
    applicant_address: Mapped[str | None] = mapped_column(String, nullable=True)

    # Automatic OCR pre-check (JSON-stringified {verdict, checks}) run
    # against the parcel's stored ParcelDocument at creation time, for
    # LAND_CLAIM_REQUEST/DOCUMENT_VERIFICATION_REQUEST only - reuses the
    # existing OCR/field-matcher code as an aid shown to the officer, not
    # an instant citizen-facing verdict.
    verification_precheck: Mapped[str | None] = mapped_column(Text, nullable=True)

    # A citizen-submitted file attached to THIS specific request -
    # distinct from a parcel's official ParcelDocument, since e.g. a
    # DISPUTE_FILING's evidence must never overwrite the parcel's existing
    # (someone else's) legitimate paperwork. Only LAND_CLAIM_REQUEST/
    # DOCUMENT_VERIFICATION_REQUEST ever promote this into becoming the
    # parcel's ParcelDocument, and only on approval.
    evidence_file_name: Mapped[str | None] = mapped_column(String, nullable=True)
    evidence_file_path: Mapped[str | None] = mapped_column(String, nullable=True)
    evidence_mime_type: Mapped[str | None] = mapped_column(String, nullable=True)
    evidence_extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    steps: Mapped[list["WorkflowStep"]] = relationship(back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowStep.step_order")


class WorkflowStep(Base):
    """The simulated review pipeline a workflow moves through (LAND_RECORDS
    -> REGISTRATION -> PLANNING -> officer decision). Auto-created (all
    PENDING) when a workflow is submitted.
    """

    __tablename__ = "workflow_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflows.id", ondelete="CASCADE"), index=True)
    workflow: Mapped["Workflow"] = relationship(back_populates="steps")

    step_order: Mapped[int] = mapped_column()
    department: Mapped[str] = mapped_column(String(30))  # LAND_RECORDS | REGISTRATION | PLANNING | DISPUTE | TAX | RESTRICTION | ENCUMBRANCE
    assigned_role: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="PENDING")  # PENDING | IN_PROGRESS | APPROVED | REJECTED
    action: Mapped[str | None] = mapped_column(String(40), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Not a server-default timestamp - this is a business-domain value set
    # explicitly by workflows_service on approve/reject, not an automatic
    # row-lifecycle timestamp.
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
