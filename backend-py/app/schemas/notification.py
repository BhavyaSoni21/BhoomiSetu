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
