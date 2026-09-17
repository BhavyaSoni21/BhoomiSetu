"""Ported from backend/src/users/users.controller.ts.

Admin-only throughout (docs/FEATURE_AUDIT.md §8 item 11 - Tech.md §38's
"User Management"/"Role Management" for the Admin role). Every mutation
is audit-logged, and an admin can't change their own role or delete
their own account through this endpoint, to avoid a self-lockout.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.auth.passwords import hash_password
from app.database import get_db
from app.models.user import User
from app.schemas.user import CreateUser, PublicUserOut, UpdateUserRole
from app.services import audit_service
from app.services import users_service as service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[PublicUserOut])
def find_all(db: Session = Depends(get_db), _admin: User = Depends(require_roles("ADMIN"))):
    return service.find_all(db)


@router.post("", response_model=PublicUserOut, status_code=status.HTTP_201_CREATED)
def create(dto: CreateUser, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    if service.find_by_email(db, dto.email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with this email already exists")

    created = service.create(
        db, email=dto.email, password_hash=hash_password(dto.password), name=dto.name, role=dto.role,
        district=dto.district,
        # Admin-provisioned staff accounts are already trusted - no OTP
        # concept applies to them, so their email starts verified rather
        # than needing a step that doesn't exist in their flow.
        email_verified=True,
    )
    audit_service.log(
        db, user_id=str(admin.id), user_role=admin.role, action="USER_CREATED", entity_type="USER",
        entity_id=str(created.id), metadata={"email": created.email, "role": created.role, "district": created.district},
    )
    return created


@router.patch("/{id}/role", response_model=PublicUserOut)
def update_role(id: UUID, dto: UpdateUserRole, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    if id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot change your own role")

    updated = service.update_role(db, id, dto.role)
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User not found: {id}")

    audit_service.log(db, user_id=str(admin.id), user_role=admin.role, action="USER_ROLE_CHANGED", entity_type="USER", entity_id=str(id), metadata={"newRole": dto.role})
    return updated


@router.post("/{id}/revoke-sessions", status_code=status.HTTP_204_NO_CONTENT)
def revoke_sessions(id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    if id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot revoke your own sessions")

    user = service.find_by_id(db, id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User not found: {id}")

    user.token_version += 1
    db.flush()

    audit_service.log(db, user_id=str(admin.id), user_role=admin.role, action="USER_SESSIONS_REVOKED", entity_type="USER", entity_id=str(id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def remove(id: UUID, db: Session = Depends(get_db), admin: User = Depends(require_roles("ADMIN"))):
    if id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot delete your own account")

    if not service.remove(db, id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"User not found: {id}")

    audit_service.log(db, user_id=str(admin.id), user_role=admin.role, action="USER_DELETED", entity_type="USER", entity_id=str(id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
