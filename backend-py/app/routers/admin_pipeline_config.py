"""Admin-only workflow pipeline configuration management.

Replaces the hardcoded _PIPELINES_BY_TYPE / _DEFAULT_PIPELINE in workflows_service.py
with admin-editable configurations stored in the database.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.workflow import (
    CreateWorkflowPipelineConfig,
    UpdateWorkflowPipelineConfig,
    WorkflowPipelineConfigOut,
)
from app.services import audit_service, pipeline_config_service as service

router = APIRouter(prefix="/admin/workflow-pipelines", tags=["admin"])


@router.get("", response_model=list[WorkflowPipelineConfigOut])
def find_all(db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    return service.get_all_pipeline_configs(db)


@router.post("", response_model=WorkflowPipelineConfigOut, status_code=status.HTTP_201_CREATED)
def create(dto: CreateWorkflowPipelineConfig, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    try:
        created = service.create_pipeline_config(db, dto)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

    audit_service.log(
        db, user_id=str(admin.id), user_role=admin.role, action="WORKFLOW_PIPELINE_CONFIG_CREATED",
        entity_type="WORKFLOW_PIPELINE_CONFIG", entity_id=str(created.id),
        metadata={"workflow_type": created.workflow_type, "stages_count": len(created.get_stages())},
    )
    return created


@router.patch("/{id}", response_model=WorkflowPipelineConfigOut)
def update(id: UUID, dto: UpdateWorkflowPipelineConfig, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    updated = service.update_pipeline_config(db, id, dto)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pipeline config not found: {id}")

    audit_service.log(
        db, user_id=str(admin.id), user_role=admin.role, action="WORKFLOW_PIPELINE_CONFIG_UPDATED",
        entity_type="WORKFLOW_PIPELINE_CONFIG", entity_id=str(id),
        metadata=dto.model_dump(exclude_unset=True, by_alias=True),
    )
    return updated


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    if not service.delete_pipeline_config(db, id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Pipeline config not found: {id}")

    audit_service.log(db, user_id=str(admin.id), user_role=admin.role, action="WORKFLOW_PIPELINE_CONFIG_DELETED", entity_type="WORKFLOW_PIPELINE_CONFIG", entity_id=str(id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)