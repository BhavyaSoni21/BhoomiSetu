"""Notification delivery service - sends in-app notifications via SMS/email.

Extends the existing in-app notification feed (notification_feed_service)
with real delivery channels: TextBee SMS and Zoho SMTP email.

Uses the User model's verified contact info (email_verified, mobile_verified)
to send notifications for workflow events and governance alerts.
"""

import uuid
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.notification import Notification
from app.services import sms_service, email_service
from app.services.notification_feed_service import NotificationPayload


def _build_notification_html(payload: NotificationPayload) -> str:
    """Build HTML email body for a notification."""
    return f"""<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #e0e0e0;border-radius:8px">
  <h2 style="color:#1a6b3c;margin-top:0">{payload.title}</h2>
  <p>{payload.message}</p>
  <hr style="border:none;border-top:1px solid #e0e0e0">
  <p style="color:#999;font-size:0.8rem;margin-bottom:0">BhoomiSetu — Land Governance Platform</p>
</div>"""


def _build_notification_text(payload: NotificationPayload) -> str:
    """Build plain text email body for a notification."""
    return f"{payload.title}\n\n{payload.message}\n\n---\nBhoomiSetu — Land Governance Platform"


def _build_sms_message(payload: NotificationPayload) -> str:
    """Build concise SMS message (TextBee has character limits)."""
    # Keep under 160 chars for single SMS segment
    base = f"BhoomiSetu: {payload.title}. {payload.message}"
    if len(base) <= 155:
        return base
    # Truncate with ellipsis
    return base[:152] + "..."


def deliver_notification(db: Session, user_ids: list[str], payload: NotificationPayload) -> dict[str, int]:
    """
    Deliver notification to users via SMS and/or email based on verified contact info.

    Returns counts of delivery attempts per channel.
    """
    if not user_ids:
        return {"sms_sent": 0, "email_sent": 0, "skipped": 0}

    # Fetch users with their contact info
    users = list(db.scalars(select(User).where(User.id.in_([uuid.UUID(uid) for uid in user_ids]))).all())

    sms_sent = 0
    email_sent = 0
    skipped = 0

    for user in users:
        sms_ok = False
        email_ok = False

        # Send SMS if opted in and mobile is verified
        if user.notify_sms and user.mobile_verified and user.mobile_number:
            message = _build_sms_message(payload)
            if sms_service.send_sms(user.mobile_number, message):
                sms_ok = True
                sms_sent += 1

        # Send email if opted in and email is verified
        if user.notify_email and user.email_verified and user.email:
            subject = f"BhoomiSetu: {payload.title}"
            text_body = _build_notification_text(payload)
            html_body = _build_notification_html(payload)
            if email_service.send_email(user.email, subject, text_body, html_body):
                email_ok = True
                email_sent += 1

        if not sms_ok and not email_ok:
            skipped += 1

    return {"sms_sent": sms_sent, "email_sent": email_sent, "skipped": skipped}


def notify_users_with_delivery(db: Session, user_ids: list[str], payload: NotificationPayload) -> dict[str, int]:
    """
    Create in-app notifications AND deliver via SMS/email.

    This is the main entry point for callers who want full delivery.
    """
    # First create in-app notifications (existing behavior)
    from app.services.notification_feed_service import notify_users
    notify_users(db, user_ids, payload)

    # Then deliver via SMS/email
    return deliver_notification(db, user_ids, payload)