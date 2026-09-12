"""Ported from backend/src/admin/departments-admin.controller.ts.

Admin-only - a small admin-editable department directory (name/
description/contact info), separate from the six mock department domain
modules (app/routers/departments.py) - those keep working unchanged.
Every mutation is audit-logged.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.database import get_db
from app.models.user import User
from app.schemas.admin import CreateDepartment, DepartmentOut, UpdateDepartment
from app.services import audit_service
from app.services import departments_admin_service as service

router = APIRouter(prefix="/admin/departments", tags=["admin"])


@router.get("", response_model=list[DepartmentOut])
def find_all(db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    return service.find_all(db)


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create(dto: CreateDepartment, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    if service.find_by_code(db, dto.code) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A department with this code already exists")

    created = service.create(db, dto)
    audit_service.log(
        db, user_id=str(admin.id), user_role=admin.role, action="DEPARTMENT_CREATED", entity_type="DEPARTMENT",
        entity_id=str(created.id), metadata={"code": created.code, "name": created.name},
    )
    return created


@router.patch("/{id}", response_model=DepartmentOut)
def update(id: UUID, dto: UpdateDepartment, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    updated = service.update(db, id, dto)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Department not found: {id}")

    audit_service.log(
        db, user_id=str(admin.id), user_role=admin.role, action="DEPARTMENT_UPDATED", entity_type="DEPARTMENT",
        entity_id=str(id), metadata=dto.model_dump(exclude_unset=True, by_alias=True),
    )
    return updated


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    if not service.remove(db, id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Department not found: {id}")

    audit_service.log(db, user_id=str(admin.id), user_role=admin.role, action="DEPARTMENT_DELETED", entity_type="DEPARTMENT", entity_id=str(id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
