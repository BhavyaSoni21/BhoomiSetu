"""Workflow pipeline configuration service - admin-editable review pipelines."""

import json
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workflow import WorkflowPipelineConfig
from app.schemas.workflow import CreateWorkflowPipelineConfig, UpdateWorkflowPipelineConfig
from app.services.request_routing_service import PipelineStage


# Default pipeline stages matching the original hardcoded values
# These are used as fallback when no config exists in DB
DEFAULT_PIPELINE_STAGES = [
    {"department": "LAND_RECORDS", "assigned_role": "LAND_RECORD_OFFICER", "step_order": 1},
    {"department": "REGISTRATION", "assigned_role": "REGISTRATION_OFFICER", "step_order": 2},
    {"department": "PLANNING", "assigned_role": "PLANNING_OFFICER", "step_order": 3},
]

PIPELINES_BY_TYPE_DEFAULT = {
    "DISPUTE_FILING": [
        {"department": "DISPUTE", "assigned_role": "DISPUTE_OFFICER", "step_order": 1},
    ],
    "LAND_CLAIM_REQUEST": [
        {"department": "LAND_RECORDS", "assigned_role": "LAND_RECORD_OFFICER", "step_order": 1},
    ],
    "DOCUMENT_VERIFICATION_REQUEST": [
        {"department": "LAND_RECORDS", "assigned_role": "LAND_RECORD_OFFICER", "step_order": 1},
    ],
    "SURVEY_MEASUREMENT_REQUEST": [
        {"department": "SURVEY", "assigned_role": "SURVEY_OFFICER", "step_order": 1},
    ],
    "BOUNDARY_DEMARCATION_REQUEST": [
        {"department": "SURVEY", "assigned_role": "SURVEY_OFFICER", "step_order": 1},
        {"department": "DISPUTE", "assigned_role": "DISPUTE_OFFICER", "step_order": 2},
    ],
}


def get_pipeline_config(db: Session, workflow_type: str) -> Optional[WorkflowPipelineConfig]:
    """Get pipeline config for a workflow type."""
    return db.scalars(
        select(WorkflowPipelineConfig)
        .where(WorkflowPipelineConfig.workflow_type == workflow_type, WorkflowPipelineConfig.is_active == True)
    ).first()


def get_pipeline_config_by_id(db: Session, config_id: UUID) -> Optional[WorkflowPipelineConfig]:
    """Get pipeline config by ID."""
    return db.get(WorkflowPipelineConfig, config_id)


def get_all_pipeline_configs(db: Session) -> list[WorkflowPipelineConfig]:
    """Get all pipeline configs."""
    return list(db.scalars(select(WorkflowPipelineConfig).order_by(WorkflowPipelineConfig.workflow_type)).all())


def create_pipeline_config(db: Session, dto: CreateWorkflowPipelineConfig) -> WorkflowPipelineConfig:
    """Create a new pipeline configuration."""
    # Check if already exists
    existing = get_pipeline_config(db, dto.workflow_type)
    if existing:
        raise ValueError(f"Pipeline config for workflow type '{dto.workflow_type}' already exists")

    config = WorkflowPipelineConfig(
        workflow_type=dto.workflow_type,
        is_active=dto.is_active,
    )
    config.set_stages([s.model_dump() for s in dto.stages])
    db.add(config)
    db.flush()
    return config


def update_pipeline_config(db: Session, config_id: UUID, dto: UpdateWorkflowPipelineConfig) -> Optional[WorkflowPipelineConfig]:
    """Update an existing pipeline configuration."""
    config = db.get(WorkflowPipelineConfig, config_id)
    if config is None:
        return None

    if dto.stages is not None:
        config.set_stages([s.model_dump() for s in dto.stages])
    if dto.is_active is not None:
        config.is_active = dto.is_active

    db.flush()
    return config


def delete_pipeline_config(db: Session, config_id: UUID) -> bool:
    """Delete a pipeline configuration."""
    config = db.get(WorkflowPipelineConfig, config_id)
    if config is None:
        return False
    db.delete(config)
    db.flush()
    return True


def get_pipeline_stages_for_workflow_type(db: Session, workflow_type: str) -> list[PipelineStage]:
    """
    Get pipeline stages for a workflow type.
    Reads from DB if config exists, otherwise falls back to hardcoded defaults.
    This replaces the old _pipeline_for() function in workflows_service.py.
    """
    config = get_pipeline_config(db, workflow_type)
    if config:
        stages = config.get_stages()
        if stages:
            return [PipelineStage(department=s["department"], assigned_role=s["assigned_role"]) for s in stages]

    # Fallback to hardcoded defaults
    default_stages = PIPELINES_BY_TYPE_DEFAULT.get(workflow_type, DEFAULT_PIPELINE_STAGES)
    return [PipelineStage(department=s["department"], assigned_role=s["assigned_role"]) for s in default_stages]