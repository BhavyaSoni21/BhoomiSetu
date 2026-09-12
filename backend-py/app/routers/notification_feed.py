"""Ported from backend/src/notification-feed/notification-feed.controller.ts.

Open to any authenticated user regardless of role (citizen or staff both
have their own notification feed) - just get_current_user, no
require_roles.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.notification import NotificationOut
from app.services import notification_feed_service as service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
def find_mine(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return service.find_mine(db, str(user.id))


@router.patch("/{id}/read", response_model=NotificationOut)
def mark_read(id: UUID, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    notification = service.mark_read(db, str(id), str(user.id))
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Notification not found: {id}")
    return notification
