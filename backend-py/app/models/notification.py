"""Ported from backend/src/notification-feed/notification.entity.ts.

In-app notification feed - a real per-user row, not a broadcast, so
"read" state never needs a separate join table. `user_id` is a plain
string like AuditLog.user_id (no FK) - this table is written by several
independent modules (Workflows, Governance) that shouldn't need to
depend on the users module just to reference a user id. Named
`notification` (not `notifications`) to stay distinct from the
future backend/src/notifications/-equivalent module, which will be OTP
SMS/email delivery infra only and has nothing to do with this in-app
feed.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_id", "user_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String)
    # WORKFLOW_ASSIGNED | WORKFLOW_STEP_APPROVED | WORKFLOW_STEP_REJECTED |
    # GOVERNANCE_ALERT_RESOLVED | GOVERNANCE_ALERT_DISMISSED
    type: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(120))
    message: Mapped[str] = mapped_column(Text)
    parcel_id: Mapped[str | None] = mapped_column(String, nullable=True)
    workflow_id: Mapped[str | None] = mapped_column(String, nullable=True)
    alert_id: Mapped[str | None] = mapped_column(String, nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
