"""Ported from backend/src/notification-feed/notification-feed.service.ts."""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification


@dataclass
class NotificationPayload:
    type: str
    title: str
    message: str
    parcel_id: str | None = None
    workflow_id: str | None = None
    alert_id: str | None = None


def notify_users(db: Session, user_ids: list[str], payload: NotificationPayload, *, deliver: bool = False) -> None:
    """Callers (WorkflowsService, GovernanceAlertsService) resolve their own
    recipient user ids - this module deliberately doesn't know about roles
    or departments, keeping it a pure leaf. One row per recipient, so each
    officer's read state is independent even when several hold the same
    role.

    If deliver=True, also attempts SMS/email delivery via notification_delivery_service.
    """
    if not user_ids:
        return
    db.add_all(
        [
            Notification(
                user_id=user_id, type=payload.type, title=payload.title, message=payload.message,
                parcel_id=payload.parcel_id, workflow_id=payload.workflow_id, alert_id=payload.alert_id,
            )
            for user_id in user_ids
        ]
    )
    db.flush()

    if deliver:
        # Import here to avoid circular dependency
        from app.services.notification_delivery_service import deliver_notification
        deliver_notification(db, user_ids, payload)


def find_mine(db: Session, user_id: str) -> list[Notification]:
    return list(db.scalars(select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())).all())


def mark_read(db: Session, notification_id: str, user_id: str) -> Notification | None:
    notification = db.scalars(select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)).first()
    if notification is None:
        return None
    notification.read = True
    db.flush()
    return notification
