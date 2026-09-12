"""Ported from backend/src/auth/pending-registration.entity.ts.

A citizen registration that hasn't proven ownership of its contact
method yet - no User row exists for this person until
verify_registration_otp() succeeds, so nothing here can be used to log
in, and abandoning it (never entering the code) leaves no account
behind. Single OTP column set, unlike User's separate email_otp*/
sms_otp* pairs - `method` is fixed for the lifetime of one pending
registration.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PendingRegistration(Base):
    __tablename__ = "pending_registrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String)
    method: Mapped[str] = mapped_column(String(10))  # EMAIL | MOBILE

    # Unique (nullable-safe, same as User's own email/mobile_number index)
    # so a race between two concurrent register() calls for the same
    # contact can't create two live pending rows for it.
    email: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    mobile_number: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)

    password_hash: Mapped[str] = mapped_column(String)

    otp_code_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    otp_expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    otp_sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    otp_attempts: Mapped[int] = mapped_column(default=0)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
