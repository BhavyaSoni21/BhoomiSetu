"""Ported from backend/src/audit/audit.service.ts."""

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.common.pagination import resolve_pagination
from app.models.audit import AuditLog


def log(
    db: Session,
    *,
    user_id: str,
    user_role: str,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    parcel_id: str | None = None,
    case_id: str | None = None,
    task_id: str | None = None,
    decision_id: str | None = None,
    previous_value: dict | str | None = None,
    new_value: dict | str | None = None,
    reason: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Fire-and-forget from the caller's perspective (still flushed so a
    write failure surfaces rather than being silently lost), but never
    blocks the actual action it's recording - callers invoke this after
    their own mutation has already succeeded, so a logging problem never
    rolls back a real workflow/alert decision.

    All new §58 parameters (case_id, task_id, decision_id, previous_value,
    new_value, reason) are optional and default to None, preserving backward
    compatibility with existing callers.
    """
    db.add(
        AuditLog(
            user_id=user_id,
            user_role=user_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            parcel_id=parcel_id,
            case_id=case_id,
            task_id=task_id,
            decision_id=decision_id,
            previous_value=json.dumps(previous_value) if previous_value else None,
            new_value=json.dumps(new_value) if new_value else None,
            reason=reason,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
    )
    db.flush()


def log_case_mutation(
    db: Session,
    *,
    user_id: str,
    user_role: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    case_id: str,
    task_id: str | None = None,
    decision_id: str | None = None,
    parcel_id: str | None = None,
    previous_value: dict | str | None = None,
    new_value: dict | str | None = None,
    reason: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    """Log a database mutation linked to a case (§58).

    Convenience wrapper around log() that requires case_id, enforcing
    that every case-linked change is traceable.
    """
    log(
        db,
        user_id=user_id,
        user_role=user_role,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        parcel_id=parcel_id,
        case_id=case_id,
        task_id=task_id,
        decision_id=decision_id,
        previous_value=previous_value,
        new_value=new_value,
        reason=reason,
        metadata=metadata,
    )


def find_all(
    db: Session,
    *,
    entity_type: str | None = None,
    user_id: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
) -> list[AuditLog]:
    take, skip = resolve_pagination(limit, offset)
    stmt = select(AuditLog)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    stmt = stmt.order_by(AuditLog.created_at.desc()).limit(take).offset(skip)
    return list(db.scalars(stmt).all())


def find_by_parcel(db: Session, parcel_id: str) -> list[AuditLog]:
    take, skip = resolve_pagination()
    stmt = (
        select(AuditLog)
        .where(AuditLog.parcel_id == parcel_id)
        .order_by(AuditLog.created_at.desc())
        .limit(take)
        .offset(skip)
    )
    return list(db.scalars(stmt).all())
