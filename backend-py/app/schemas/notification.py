from datetime import datetime
from uuid import UUID

from app.schemas.base import CamelModel


class NotificationOut(CamelModel):
    id: UUID
    user_id: str
    type: str
    title: str
    message: str
    parcel_id: str | None
    workflow_id: str | None
    alert_id: str | None
    read: bool
    created_at: datetime


class NotificationPrefsOut(CamelModel):
    """Per-channel notification opt-outs. SMS/email still additionally require
    the channel's contact to be verified before anything is actually sent."""
    notify_sms: bool
    notify_email: bool
    notify_in_app: bool


class NotificationPrefsUpdate(CamelModel):
    notify_sms: bool | None = None
    notify_email: bool | None = None
    notify_in_app: bool | None = None

    model_config = {'extra': 'forbid'}
