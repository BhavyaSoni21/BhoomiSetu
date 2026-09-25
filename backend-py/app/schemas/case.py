from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import CamelModel


class TaskAssignIn(CamelModel):
    """Input for assigning an officer to a department task (§59)."""
    officer_id: str
    stage_name: str | None = None


class TaskAdvanceIn(CamelModel):
    """Input for advancing a department task through workflow stages (§23)."""
    status: str
    stage_name: str | None = None
    remarks: str | None = None


class TaskResolveIn(CamelModel):
    """Input for applying a resolution decision to a department task (§34, §36)."""
    decision: str
    # APPROVE | REJECT | RETURN_FOR_REVIEW
    officer_id: str
    remarks: str | None = None


class ProposedFieldChangeIn(CamelModel):
    """Input for proposing a field change (§37)."""
    parcel_id: str
    department: str
    field_name: str
    current_value: str | None = None
    proposed_value: str
    reason: str | None = None


class FieldChangeApprovalIn(CamelModel):
    """Input for an officer approving or rejecting a proposed field change (§37, §39)."""
    decision: str
    # APPROVE | REJECT
    remarks: str | None = None


class ProposedFieldChangeOut(CamelModel):
    """Output schema for a proposed field change (§37)."""
    id: UUID
    case_id: UUID
    parcel_id: str
    department: str
    field_name: str
    current_value: str | None = None
    proposed_value: str
    reason: str | None = None
    proposed_by: str | None = None
    status: str
    decided_by: str | None = None
    decided_at: datetime | None = None
    decision_remarks: str | None = None
    created_at: datetime
    updated_at: datetime


class VerificationChecklistIn(CamelModel):
    """Input for submitting the offline document verification checklist (§47)."""
    checklist: dict[str, bool]
    remarks: str | None = None


class ApplicationVersion(CamelModel):
    """One version entry preserved for audit (§14)."""
    version_type: str
    # ORIGINAL_INPUT | CONVERSATION | AI_INTERPRETATION | AI_DRAFT | CITIZEN_EDITED | FINAL_SUBMITTED
    content: str | dict | None = None
    created_at: datetime | None = None


class ApplicationOut(CamelModel):
    """Application artifact schema (§14, §16)."""
    id: UUID
    case_id: UUID
    original_input: str | None = None
    conversation: list[dict[str, Any]] | None = None
    ai_interpretation: dict | None = None
    ai_draft: str | None = None
    citizen_edited_version: str | None = None
    final_submitted_version: str | None = None
    generated_document_path: str | None = None
    generated_at: datetime | None = None
    citizen_confirmed: bool
    citizen_confirmation_timestamp: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ApplicationCreate(CamelModel):
    """Input for creating a case from a citizen's confirmed application (§9, §13)."""
    parcel_id: str
    intent: str | None = None
    priority: str | None = None
    application_draft: str | None = None
    citizen_edited_version: str | None = None
    ai_structured_understanding: dict | None = None
    facts_database: list[str] | None = None
    citizen_statements: list[str] | None = None
    conversation: list[dict[str, Any]] | None = None
    routing_result: dict | None = None


class CaseCreate(CamelModel):
    parcel_id: UUID
    intent: str | None = None
    priority: str | None = None
    # LOW | MEDIUM | HIGH | CRITICAL


class CaseOut(CamelModel):
    id: UUID
    case_no: str
    citizen_id: str
    parcel_id: str
    intent: str | None = None
    status: str
    # CREATED | ACTIVE | RESOLUTION | FEEDBACK | CLOSED
    priority: str | None = None
    routing_decision: dict | None = None
    sla_config_id: UUID | None = None
    created_at: datetime
    resolved_at: datetime | None = None
    closed_at: datetime | None = None


class CaseStatusUpdate(CamelModel):
    status: str
    # CREATED | ACTIVE | RESOLUTION | FEEDBACK | CLOSED
    remarks: str | None = None


class DepartmentTaskOut(CamelModel):
    id: UUID
    case_id: UUID
    case_no: str | None = None  # human-readable case number, populated from the parent case
    department_id: UUID
    workflow_id: UUID | None = None
    status: str
    # PENDING | ASSIGNED | IN_PROGRESS | BLOCKED | COMPLETED | CANCELLED
    assigned_officer_id: str | None = None
    assigned_verifier_id: str | None = None
    assigned_at: datetime | None = None
    stage: int
    stage_name: str | None = None
    resolution_mode: str | None = None
    # DIGITAL | FIELD_VERIFICATION | OFFLINE_APPOINTMENT | HYBRID | MANUAL_REVIEW
    resolution_decision: str | None = None
    # APPROVE | REJECT | RETURN_FOR_REVIEW
    resolution_remarks: str | None = None
    sla_threshold_hours: float | None = None
    sla_warning_threshold: float | None = None
    sla_breach_threshold: float | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class AIAnalysisOut(CamelModel):
    id: UUID
    case_id: UUID
    structured_understanding: dict | None = None
    facts_stated: list[dict] | None = None
    facts_verified: list[dict] | None = None
    departments_identified: list[dict] | None = None
    application_draft: str | None = None
    follow_up_questions: list[str] | None = None
    conversation: list[dict] | None = None
    created_at: datetime
    updated_at: datetime


class RoutingDecisionOut(CamelModel):
    id: UUID
    case_id: UUID
    departments_routed: list[dict] | None = None
    workflow_per_department: dict | None = None
    priority: str | None = None
    created_at: datetime


class SLAConfigOut(CamelModel):
    id: UUID
    workflow_id: UUID | None = None
    task_id: UUID | None = None
    department_id: UUID | None = None
    threshold_hours: float
    warning_threshold: float
    breach_threshold: float
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AppointmentCreate(CamelModel):
    citizen_id: str
    department_id: str
    officer_id: str | None = None
    office_location: str | None = None
    date: datetime
    time_slot: str | None = None
    purpose: str | None = None
    required_documents: list[str] | None = None


class AppointmentOut(CamelModel):
    id: UUID
    case_id: UUID
    citizen_id: str
    department_id: UUID
    officer_id: str | None = None
    office_location: str | None = None
    date: datetime
    time_slot: str | None = None
    purpose: str | None = None
    required_documents: list[str] | None = None
    status: str
    # REQUESTED | CONFIRMED | RESCHEDULED | COMPLETED | CANCELLED | NO_SHOW
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class AppointmentUpdate(CamelModel):
    officer_id: str | None = None
    office_location: str | None = None
    date: datetime | None = None
    time_slot: str | None = None
    purpose: str | None = None
    required_documents: list[str] | None = None
    status: str | None = None
    remarks: str | None = None

    model_config = {'extra': 'forbid'}


class CaseTimelineEventOut(CamelModel):
    id: UUID
    case_id: UUID
    task_id: UUID | None = None
    event_type: str
    actor_id: str | None = None
    actor_role: str | None = None
    # Resolved for display: actor's real name and (for officers) department,
    # populated by the timeline endpoint so the UI need not show a raw id.
    actor_name: str | None = None
    actor_department: str | None = None
    previous_state: str | None = None
    new_state: str | None = None
    # ORM attr is `event_metadata` (DB column "metadata"); read by that name so
    # Pydantic doesn't pick up SQLAlchemy's Base.metadata registry off `.metadata`.
    event_metadata: dict | None = Field(default=None, validation_alias="event_metadata", serialization_alias="metadata")
    created_at: datetime


class FeedbackCreate(CamelModel):
    category: str | None = None
    # RESPONSE_TIME | OFFICER_COMMUNICATION | RESOLUTION_CLARITY | FIELD_VERIFICATION | OVERALL | OTHER
    officer_rating: int | None = None
    # 1-5
    overall_case_rating: int | None = None
    # 1-5
    type: str | None = None
    # OFFICER_RATING | OVERALL_CASE_RATING | OPTIONAL_COMMENTS | STRUCTURED_REASONS
    comments: str | None = None
    reasons: list[str] | None = None
    is_anonymous: bool = False
    officer_id: str | None = None
    department_id: UUID | None = None
    task_id: UUID | None = None


class FeedbackOut(CamelModel):
    id: UUID
    case_id: UUID
    citizen_id: str
    officer_id: str | None = None
    department_id: UUID | None = None
    task_id: UUID | None = None
    category: str | None = None
    officer_rating: int | None = None
    overall_case_rating: int | None = None
    type: str | None = None
    comments: str | None = None
    reasons: list[str] | None = None
    is_anonymous: bool
    created_at: datetime


class CaseDetailOut(CamelModel):
    case: CaseOut
    tasks: list[DepartmentTaskOut]
    timeline: list[CaseTimelineEventOut]
    feedback: list[FeedbackOut]
    aiAnalysis: AIAnalysisOut | None = None
    routingDecision: RoutingDecisionOut | None = None


class CaseListResponse(CamelModel):
    cases: list[CaseOut]
    total: int


class CaseRouteToDepartments(CamelModel):
    departments: list[dict]
    # [{department, confidence, reason}]
    workflow_per_department: dict | None = None
    priority: str | None = None


class CaseGeometryVersionCreate(CamelModel):
    parcel_id: str
    version_number: int
    geometry: dict
    # GeoJSON Polygon
    is_proposed: bool = True
    change_reason: str | None = None
    decision_id: UUID | None = None
    verification_id: UUID | None = None


class VerifierAssignmentIn(CamelModel):
    """Input for assigning a verifier to a department task (§29)."""
    verifier_id: str


class VerifierAssignmentOut(CamelModel):
    """Output confirming a verifier was assigned to a task (§29)."""
    id: UUID
    case_id: UUID
    department_id: UUID
    status: str
    assigned_verifier_id: str | None = None
    assigned_at: datetime | None = None


class VerifierWithWorkloadOut(CamelModel):
    """A VERIFIER-role user plus their active-task count, for the officer's
    assignment picker (§29). `active_task_count` = tasks assigned to them that
    aren't COMPLETED/CANCELLED — lets the officer balance load."""
    id: UUID
    name: str
    email: str | None = None
    district: str | None = None
    role: str
    active_task_count: int = 0


class EvidenceCaptureRequest(CamelModel):
    """Input for capturing GPS + photo evidence by a verifier (§31)."""
    latitude: float
    longitude: float
    accuracy_m: float | None = None
    captured_at: datetime | None = None
    photo_hash: str | None = None
    sequence: int | None = None
    notes: str | None = None
    task_id: UUID | None = None


class EvidenceCaptureResponse(CamelModel):
    """Output for captured evidence (§31)."""
    id: UUID
    evidence_id: str
    case_id: UUID
    verifier_id: str
    latitude: float
    longitude: float
    accuracy_m: float | None = None
    captured_at: datetime
    photo_hash: str | None = None
    sequence: int | None = None
    notes: str | None = None


class VerifierFindingIn(CamelModel):
    """Input for a single verifier finding on a parcel field (§32)."""
    field_name: str
    finding: str
    # SUPPORTED | NOT_VERIFIED | CONTRADICTED | PARTIALLY_VERIFIED | UNABLE_TO_DETERMINE
    description: str


class VerifierFindingsIn(CamelModel):
    """Input for submitting a verifier's complete field findings (§32)."""
    findings: list[VerifierFindingIn]
    overall_finding: str
    # SUPPORTED | NOT_VERIFIED | CONTRADICTED | PARTIALLY_VERIFIED | UNABLE_TO_DETERMINE
    declaration_confirmed: bool
    notes: str | None = None
    task_id: UUID | None = None


class VerifierFindingOut(CamelModel):
    """Output schema for a verifier finding."""
    id: UUID
    case_id: UUID
    verifier_id: str
    task_id: UUID | None = None
    findings: list[dict]
    overall_finding: str
    declaration_confirmed: bool
    notes: str | None = None
    submitted_at: datetime


class VerifierPackageOut(CamelModel):
    """The offline case package returned to a verifier (§30)."""
    case: dict
    parcel: dict | None = None
    parcel360: dict | None = None
    application: dict | None = None
    tasks: list[dict]
    taskInstructions: list[dict]
    departmentRecords: dict
    timeline: list[dict]
    aiAnalysis: dict | None = None
    routingDecision: dict | None = None
    evidence: list[dict]
