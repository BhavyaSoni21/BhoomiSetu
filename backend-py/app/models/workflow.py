"""Ported from backend/src/workflows/workflow.entity.ts +
workflow-step.entity.ts.

backend-py is Postgres-only (no SQLite driver), so WorkflowStep's
completed_at - a 'datetime'/'timestamp' driver-specific column in the TS
entity - is always plain DateTime here.
"""

import json
import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, Index, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Which workflow types genuinely need a Verifier's field visit, vs. a plain
# desk request (e.g. ROR_COPY_REQUEST/CORRECTION_REQUEST) that never leaves
# the office. Deterministic set over this app's fixed, known workflow types
# (BACKLOG.md item 26) - no AI tiebreaker needed since none of the 5 real
# types are ambiguous; add a classifier only if a genuinely ambiguous type
# shows up later.
FIELD_VERIFICATION_WORKFLOW_TYPES = {"LAND_CLAIM_REQUEST", "DISPUTE_FILING", "DOCUMENT_VERIFICATION_REQUEST"}


# Default workflow templates (§21) — reusable templates departments can use.
DEFAULT_WORKFLOW_TEMPLATES = [
    "DIGITAL_RECORD_CORRECTION",
    "FIELD_VERIFICATION",
    "TAX_REVIEW",
    "DOCUMENT_VERIFICATION",
    "DISPUTE_REVIEW",
    "OFFLINE_APPOINTMENT",
    "GEOMETRY_CORRECTION",
    "ENCUMBRANCE_VERIFICATION",
    "MANUAL_REVIEW",
]

# Stage types for workflow conditions (§22, §23).
WORKFLOW_STAGE_TYPES = [
    "REVIEW",
    "ASSIGN_VERIFIER",
    "FIELD_VERIFICATION",
    "EVIDENCE_REVIEW",
    "DECISION",
    "APPOINTMENT",
    "DIGITAL_UPDATE",
    "OFFLINE_REVIEW",
    "MANUAL_REVIEW",
]


class WorkflowPipelineConfig(Base):
    """Admin-editable review pipeline configuration per workflow type.

    Replaces the hardcoded _PIPELINES_BY_TYPE / _DEFAULT_PIPELINE in workflows_service.py.
    Each config defines an ordered list of stages (department + assigned_role).

    Extended for §21-§23: now also stores the full workflow definition
    (stages with types, capabilities, conditions, resolution modes,
    decision types) for the Department Workflow Configuration spec.
    """

    __tablename__ = "workflow_pipeline_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_type: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    # JSON array of {"department": str, "assigned_role": str, "step_order": int}
    stages_json: Mapped[str] = mapped_column(Text, default="[]")
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    # §21: Template name from DEFAULT_WORKFLOW_TEMPLATES
    template: Mapped[str | None] = mapped_column(String(40), nullable=True)

    # §23: Full workflow definition (§23): stages, capabilities, SLA,
    # conditions, required documents/evidence, verifier requirement,
    # appointment requirement, permitted mutations, decision types,
    # notifications, feedback rules.
    definition_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # JSON: {"stages": [{"id", "type", "condition"}, ...], "capabilities": [...],
    #        "sla": {...}, "conditions": [...], "required_documents": [...],
    #        "verifier_required": bool, "appointment_allowed": bool,
    #        "permitted_mutations": [...], "decision_types": [...],
    #        "notifications": {...}, "feedback_rules": {...}}

    # §36: Resolution modes this workflow supports
    resolution_modes: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # §34: Decision types permitted for this workflow
    decision_types: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # §22: Conditional path definitions
    conditions_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    @property
    def stages(self) -> list[dict]:
        """Return parsed stages for API serialization."""
        try:
            return json.loads(self.stages_json)
        except (json.JSONDecodeError, TypeError):
            return []

    def get_stages(self) -> list[dict]:
        """Return parsed stages as list of dicts with department, assigned_role, step_order."""
        return self.stages

    def set_stages(self, stages: list[dict]) -> None:
        """Set stages from list of dicts, ensuring step_order is sequential."""
        for i, stage in enumerate(stages):
            stage["step_order"] = i + 1
        self.stages_json = json.dumps(stages)

    @property
    def definition(self) -> dict | None:
        """Return parsed workflow definition (§23)."""
        if not self.definition_json:
            return None
        try:
            return json.loads(self.definition_json)
        except (json.JSONDecodeError, TypeError):
            return None

    def set_definition(self, definition: dict) -> None:
        """Set the full workflow definition (§23)."""
        self.definition_json = json.dumps(definition)

    @property
    def conditions(self) -> list[dict] | None:
        """Return parsed conditional path definitions (§22)."""
        if not self.conditions_json:
            return None
        try:
            return json.loads(self.conditions_json)
        except (json.JSONDecodeError, TypeError):
            return None

    def set_conditions(self, conditions: list[dict]) -> None:
        """Set conditional path definitions (§22)."""
        self.conditions_json = json.dumps(conditions)


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

    # The Verifier assigned (by an Admin) to make the field visit for this
    # workflow - same "string, not a real FK" convention as citizen_id
    # above. Null until assigned; set once, not a history of reassignments.
    assigned_verifier_id: Mapped[str | None] = mapped_column(String, nullable=True)

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
    # OpenCV tamper/authenticity heuristic (BACKLOG.md item 15) - a soft
    # signal shown next to the OCR field-match checks, not a hard gate.
    # Reasons stored as a JSON-encoded list (Text column, same convention
    # as verification_precheck) since it's read back as a whole, never
    # queried by individual reason.
    evidence_authenticity_suspicious: Mapped[bool | None] = mapped_column(nullable=True)
    evidence_authenticity_reasons: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    steps: Mapped[list["WorkflowStep"]] = relationship(back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowStep.step_order")

    @property
    def requires_field_verification(self) -> bool:
        return self.workflow_type in FIELD_VERIFICATION_WORKFLOW_TYPES


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
