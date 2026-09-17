"""Ported from backend/src/audit/audit.controller.ts.

Admin-only (docs/FEATURE_AUDIT.md §8 item 10) - a platform-wide audit
trail is an oversight tool, not something any individual officer needs
to browse.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.deps import require_roles
from app.database import get_db
from app.schemas.audit import AuditLogOut
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def find_all(
    entity_type: str | None = Query(None, alias="entityType"),
    user_id: str | None = Query(None, alias="userId"),
    limit: int | None = None,
    offset: int | None = None,
    db: Session = Depends(get_db),
    _admin=Depends(require_roles("ADMIN")),
):
    return audit_service.find_all(db, entity_type=entity_type, user_id=user_id, limit=limit, offset=offset)
