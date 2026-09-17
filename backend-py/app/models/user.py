"""Ported from backend/src/users/user.entity.ts.

Real accounts backing officer/admin/citizen sessions. Scoped to Officer +
Admin + Citizen roles alike (role itself mixes staff and citizen
concerns) - officer/admin accounts just get emailVerified=True at
creation time (admin-provisioned, already trusted) and never touch
mobileNumber/mobile OTP.

backend-py is Postgres-only (no SQLite driver), so the OTP-expiry columns
that had to switch between 'datetime'/'timestamp' by driver in the TS
entity are always plain DateTime here.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Both nullable ("at least one present" is a service-layer/DTO
    # constraint, not a DB one) - a Postgres unique index already allows
    # multiple NULLs on both columns, so two citizens who've each only
    # added a mobile number don't collide on a shared NULL email.
    # NOTE: explicit name= overrides map Python snake_case attrs to the
    # camelCase column names that TypeORM created in the existing DB.
    email: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    mobile_number: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)

    email_verified: Mapped[bool] = mapped_column(default=False)
    mobile_verified: Mapped[bool] = mapped_column(default=False)

    # Staged new value for the Profile "change contact" flow - the old
    # verified method is never dropped before the new one is confirmed
    # working; verifying a pending value copies it into email/mobile_number
    # above and clears this, rather than ever overwriting a live verified
    # value up front.
    pending_email: Mapped[str | None] = mapped_column(String, nullable=True)
    pending_mobile_number: Mapped[str | None] = mapped_column(String, nullable=True)

    # Email OTP challenge state. Both methods store the hashed code +
    # expiry here and verify locally (bcrypt compare) rather than
    # delegating to a provider.
    email_otp_code_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    email_otp_expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    # Resend rate-limiting and lockout for email OTP (reset on every new send).
    email_otp_sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    email_otp_attempts: Mapped[int] = mapped_column(default=0)

    # SMS OTP challenge state - mirrors the email OTP columns above.
    sms_otp_code_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    sms_otp_expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    sms_otp_sent_at: Mapped[datetime | None] = mapped_column(nullable=True)
    sms_otp_attempts: Mapped[int] = mapped_column(default=0)

    password_hash: Mapped[str] = mapped_column(String)

    # Bumped on explicit logout (KNOWN_RISKS.md HIGH-2) so a JWT issued
    # before that point - this device's, or any other copy of it - stops
    # validating immediately instead of staying valid forever, since tokens
    # themselves carry no expiry. Token verification rejects any token
    # whose embedded token_version doesn't match this current value.
    token_version: Mapped[int] = mapped_column(default=0)

    # Last activity timestamp for idle timeout tracking.
    # Updated on each authenticated request via middleware.
    last_activity_at: Mapped[datetime | None] = mapped_column(nullable=True)

    name: Mapped[str] = mapped_column(String)
    # ADMIN | LAND_RECORD_OFFICER | REGISTRATION_OFFICER | PLANNING_OFFICER |
    # DISPUTE_OFFICER | TAX_OFFICER | RESTRICTION_OFFICER |
    # ENCUMBRANCE_OFFICER | CITIZEN
    role: Mapped[str] = mapped_column(String(30))

    # Profile "more info" fields - citizen-editable, no OTP step (unlike
    # email/mobile above - these aren't identity-verification critical).
    # Nullable/optional for every existing account, including staff.
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    government_id_number: Mapped[str | None] = mapped_column(String, nullable=True)
    occupation: Mapped[str | None] = mapped_column(String, nullable=True)

    # District assignment for officers - used for jurisdiction-aware request routing.
    # Nullable; only meaningful for staff roles (officers/admin/verifier).
    district: Mapped[str | None] = mapped_column(String(40), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
