"""Ported from backend/src/workflows/dto/workflow.dto.ts +
workflow.entity.ts/workflow-step.entity.ts response shapes.
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel


class PipelineStageConfig(CamelModel):
    """Single stage in a workflow pipeline configuration."""
    department: str = Field(max_length=30)
    assigned_role: str = Field(max_length=40)
    step_order: int


class WorkflowPipelineConfigOut(CamelModel):
    """Workflow pipeline configuration output."""
    id: UUID
    workflow_type: str
    stages: list[PipelineStageConfig]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CreateWorkflowPipelineConfig(CamelModel):
    """Create a new workflow pipeline configuration."""
    workflow_type: str = Field(max_length=40)
    stages: list[PipelineStageConfig] = Field(min_length=1)
    is_active: bool = True


class UpdateWorkflowPipelineConfig(CamelModel):
    """Update an existing workflow pipeline configuration."""
    stages: list[PipelineStageConfig] | None = Field(default=None, min_length=1)
    is_active: bool | None = None


class CreateWorkflow(CamelModel):
    parcel_id: UUID
    workflow_type: str = Field(max_length=40)  # free-form, not a fixed enum
    created_by: str | None = Field(default=None, max_length=100)
    request_details: str | None = None


class UpdateWorkflowStatus(CamelModel):
    status: str = Field(max_length=20)
    remarks: str | None = None


class ReviewWorkflowStep(CamelModel):
    action: Literal["APPROVE", "REJECT"]
    # Mandatory: an officer approving or rejecting a request must always
    # record why.
    remarks: str = Field(min_length=1)


class EscalateWorkflowStep(CamelModel):
    message: str = Field(min_length=1)


class ReopenWorkflowStep(CamelModel):
    message: str = Field(min_length=1)


class AssignVerifier(CamelModel):
    verifier_id: UUID


class FieldEvidenceOut(CamelModel):
    id: UUID
    workflow_id: UUID
    verifier_id: str
    photo_file_name: str
    mime_type: str
    latitude: float
    longitude: float
    captured_at: datetime
    notes: str | None
    created_at: datetime


class WorkflowStepOut(CamelModel):
    id: UUID
    step_order: int
    department: str
    assigned_role: str
    status: str
    action: str | None
    remarks: str | None
    completed_at: datetime | None


class WorkflowOut(CamelModel):
    id: UUID
    parcel_id: str
    workflow_type: str
    current_status: str
    created_by: str | None
    request_details: str | None
    last_remarks: str | None
    routing_notes: str | None
    citizen_id: str | None
    assigned_verifier_id: str | None
    requires_field_verification: bool
    applicant_contact: str | None
    applicant_address: str | None
    verification_precheck: str | None
    evidence_file_name: str | None
    evidence_file_path: str | None
    evidence_mime_type: str | None
    evidence_extracted_text: str | None
    evidence_authenticity_suspicious: bool | None
    evidence_authenticity_reasons: str | None  # JSON-encoded list[str], same convention as verification_precheck
    created_at: datetime
    updated_at: datetime
    steps: list[WorkflowStepOut]
