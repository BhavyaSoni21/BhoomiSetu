"""Case management models for the Unified Workflow.

Covers: Case, DepartmentTask, Application, AIAnalysis, RoutingDecision,
SLAConfig, Appointment, CaseTimelineEvent, Feedback.

Follows existing conventions: string IDs for cross-entity references
(Workflow.citizen_id, AuditLog.user_id, etc.), UUID PKs, server-default
timestamps, JSON columns for structured data.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, ForeignKey, Index, JSON, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.admin import Department


class Case(Base):
    """A citizen issue mapped to one or more parcels and departments.

    Lifecycle: No Active Case → Created → Active → Resolution → Feedback → Closed
    One active case per citizen + parcel (enforced in service layer, Invariant 1).
    """

    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_no: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    citizen_id: Mapped[str] = mapped_column(String, index=True)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    intent: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="CREATED")
    # CREATED | ACTIVE | RESOLUTION | FEEDBACK | CLOSED
    priority: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # LOW | MEDIUM | HIGH | CRITICAL

    # AI routing output (from AIAnalysis, persisted for traceability)
    routing_decision: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # SLA tracking
    sla_config_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sla_configs.id", ondelete="SET NULL"), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    tasks: Mapped[list["DepartmentTask"]] = relationship(
        back_populates="case", cascade="all, delete-orphan", order_by="DepartmentTask.stage"
    )


class ProposedFieldChange(Base):
    """A proposed change to a parcel's department-record field, pending officer
    approval (§37–§40).  The officer reviews Current Value → Proposed Value
    and either approves (triggering a transactional DB update with historical
    versioning + audit log) or rejects.
    """

    __tablename__ = "proposed_field_changes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    parcel_id: Mapped[str] = mapped_column(String, index=True)

    # Which department-record table this targets (e.g. "LAND_RECORDS",
    # "TAX", "DISPUTE", "ENCUMBRANCE", "RESTRICTION", "PLANNING", "SURVEY",
    # or "PARCEL" for the parcels table itself).
    department: Mapped[str] = mapped_column(String(50), index=True)
    field_name: Mapped[str] = mapped_column(String(100))
    current_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_value: Mapped[str] = mapped_column(Text)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_by: Mapped[str | None] = mapped_column(String, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    # PENDING | APPROVED | REJECTED

    decided_by: Mapped[str | None] = mapped_column(String, nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(nullable=True)
    decision_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_proposed_field_changes_case_status", "case_id", "status"),
    )


class Application(Base):
    """The official application document artifact linked to a Case (§14, §16).

    Preserves the full version history of the citizen's application:
    original input, conversation transcript, AI structured interpretation,
    AI-generated draft, citizen-edited version, and final submitted version.
    The final confirmed version becomes the official submitted application.

    The generated document (PDF) is attached as a case artifact.
    """

    __tablename__ = "case_applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)

    # Original citizen input (free-text description entered by the citizen)
    original_input: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Conversation transcript (§14) — JSON list of {role, text, timestamp}
    conversation: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)

    # AI structured interpretation (§14) — stored separately from AIAnalysis
    # for versioning; snapshot of what the AI understood at generation time
    ai_interpretation: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # AI-generated draft application text (§13, §14)
    ai_draft: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Citizen-edited version (§13, §14)
    citizen_edited_version: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Final submitted version (the official application, §14)
    final_submitted_version: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Generated document artifact (§16)
    generated_document_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(nullable=True)

    # Citizen confirmation (§13)
    citizen_confirmed: Mapped[bool] = mapped_column(default=False)
    citizen_confirmation_timestamp: Mapped[datetime | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())

    case: Mapped["Case"] = relationship()


class DepartmentTask(Base):
    """A department's work item within a case. One case → N department tasks.

    Each task follows its department's workflow definition (stages, conditions, SLA).
    """

    __tablename__ = "department_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"))
    workflow_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    # PENDING | ASSIGNED | IN_PROGRESS | BLOCKED | COMPLETED | CANCELLED
    assigned_officer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    assigned_verifier_id: Mapped[str | None] = mapped_column(String, nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(nullable=True)
    stage: Mapped[int] = mapped_column(default=0)
    stage_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Resolution-specific
    resolution_mode: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # DIGITAL | FIELD_VERIFICATION | OFFLINE_APPOINTMENT | HYBRID | MANUAL_REVIEW
    resolution_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # APPROVE | REJECT | RETURN_FOR_REVIEW
    resolution_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    # SLA
    sla_threshold_hours: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    sla_warning_threshold: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    sla_breach_threshold: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)

    case: Mapped["Case"] = relationship(back_populates="tasks")
    # Eager (batched) so serializing a task exposes the department's human
    # name/code without an N+1 per task or a UUID→name round-trip on the client.
    department: Mapped["Department"] = relationship(lazy="selectin")

    @property
    def department_name(self) -> str | None:
        return self.department.name if self.department else None

    @property
    def department_code(self) -> str | None:
        return self.department.code if self.department else None


class AIAnalysis(Base):
    """AI's structured understanding of a citizen's request.

    Created when AI processes the citizen's description. Citizen must
    confirm before application generation (§12, §13).
    """

    __tablename__ = "ai_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)

    # Structured understanding (§11.1)
    structured_understanding: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # JSON: {parcel_id, intent, issues, facts_stated_by_citizen, departments, ...}

    # Fact vs claim separation (§15)
    facts_stated: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    # JSON: [{statement, type: DATABASE_FACT | CITIZEN_STATEMENT, confidence}]
    facts_verified: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    # JSON: [{fact, verified: bool, source}]

    # Departments identified for routing (§17)
    departments_identified: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    # JSON: [{department, confidence, reason}]

    # Application draft (§11.2, §13)
    application_draft: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Human-readable AI-generated application text

    # Follow-up questions (§10)
    follow_up_questions: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # JSON: ["question1", "question2", ...]

    # Conversation history (§14)
    conversation: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    # JSON: [{role: citizen|ai, text, timestamp}]

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class RoutingDecision(Base):
    """AI's routing decision for a case — which departments and workflows.

    Persisted from AIAnalysis for traceability and reuse.
    """

    __tablename__ = "routing_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)

    departments_routed: Mapped[list[dict] | None] = mapped_column(JSON, nullable=True)
    # JSON: [{department, confidence, reason}]

    workflow_per_department: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # JSON: {department: {workflow, stages, capabilities}}

    priority: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class SLAConfig(Base):
    """SLA configuration per workflow/task (§56).

    SLA belongs to workflow/task, not just department.
    """

    __tablename__ = "sla_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="SET NULL"), nullable=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Specific department task this SLA applies to (nullable = applies to all tasks in workflow)
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)

    threshold_hours: Mapped[float] = mapped_column(Numeric(5, 2))
    warning_threshold: Mapped[float] = mapped_column(Numeric(5, 2))
    breach_threshold: Mapped[float] = mapped_column(Numeric(5, 2))

    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class Appointment(Base):
    """Appointment linked to a case (§45, §46).

    Citizen books, officer reviews, verifier conducts.
    """

    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    citizen_id: Mapped[str] = mapped_column(String)
    department_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("departments.id", ondelete="CASCADE"))
    officer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    office_location: Mapped[str | None] = mapped_column(String(200), nullable=True)

    date: Mapped[datetime] = mapped_column()
    time_slot: Mapped[str | None] = mapped_column(String(20), nullable=True)
    purpose: Mapped[str | None] = mapped_column(String(500), nullable=True)
    required_documents: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # JSON: ["document1", "document2", ...]

    status: Mapped[str] = mapped_column(String(20), default="REQUESTED")
    # REQUESTED | CONFIRMED | RESCHEDULED | COMPLETED | CANCELLED | NO_SHOW

    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)


class CaseTimelineEvent(Base):
    """Timeline event for a case (§57).

    Each event retains: Who, When, What happened, Previous state, New state,
    Case ID, Task ID.
    """

    __tablename__ = "case_timeline_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    event_type: Mapped[str] = mapped_column(String(50), index=True)
    # CASE_CREATED | APPLICATION_GENERATED | APPLICATION_CONFIRMED |
    # ROUTED_TO_DEPARTMENT | OFFICER_ASSIGNED | VERIFIER_ASSIGNED |
    # FIELD_VISIT_STARTED | GPS_CAPTURED | PHOTO_CAPTURED |
    # VERIFICATION_SUBMITTED | OFFICER_REVIEW_STARTED | APPOINTMENT_CREATED |
    # APPOINTMENT_COMPLETED | DATABASE_UPDATED | DECISION_APPROVED |
    # DECISION_REJECTED | CASE_CLOSED | FEEDBACK_SUBMITTED

    actor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    actor_role: Mapped[str | None] = mapped_column(String(30), nullable=True)

    previous_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    new_state: Mapped[str | None] = mapped_column(String(100), nullable=True)

    event_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    # JSON: event-specific data (GPS coords, findings summary, etc.)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Feedback(Base):
    """Citizen feedback linked to a case and officer/task (§51, §52, Invariant 11).

    Collected after case resolution. Multi-officer feedback supported.
    """

    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    citizen_id: Mapped[str] = mapped_column(String)
    officer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    department_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    task_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Feedback categories (§51)
    category: Mapped[str | None] = mapped_column(String(40), nullable=True)
    # RESPONSE_TIME | OFFICER_COMMUNICATION | RESOLUTION_CLARITY | FIELD_VERIFICATION | OVERALL | OTHER

    # Ratings (§51, §52)
    officer_rating: Mapped[int | None] = mapped_column(Numeric(1, 0), nullable=True)
    # 1-5 scale
    overall_case_rating: Mapped[int | None] = mapped_column(Numeric(1, 0), nullable=True)
    # 1-5 scale

    # Structured reasons (§51)
    type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    # OFFICER_RATING | OVERALL_CASE_RATING | OPTIONAL_COMMENTS | STRUCTURED_REASONS

    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    reasons: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # JSON: ["reason1", "reason2", ...]

    is_anonymous: Mapped[bool] = mapped_column(default=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class CaseParcelGeometryVersion(Base):
    """Geometry version history for a parcel within a case context (§43).

    Geometry V1, V2, V3, V4 ← Current, Proposed V5 → Officer approval → V5 becomes current.
    Separate from ParcelHistoricalState which is attribute-level per year.
    """

    __tablename__ = "case_parcel_geometry_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), index=True)
    parcel_id: Mapped[str] = mapped_column(String, index=True)

    version_number: Mapped[int] = mapped_column()
    geometry: Mapped[object] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False))
    is_current: Mapped[bool] = mapped_column(default=False)
    is_proposed: Mapped[bool] = mapped_column(default=False)

    change_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    changed_by: Mapped[str | None] = mapped_column(String, nullable=True)
    decision_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    verification_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    __table_args__ = (
        Index("ix_case_parcel_geom_version", "case_id", "parcel_id", "version_number", unique=True),
    )
