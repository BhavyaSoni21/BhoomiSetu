"""Ported from backend/src/auth/auth.service.ts."""

import random
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.auth.deps import create_access_token
from app.auth.passwords import hash_password, verify_password
from app.models.pending_registration import PendingRegistration
from app.models.user import User
from app.schemas.auth import ContactRequest, ProfileDetailsRequest, RegisterRequest
from app.schemas.profile_field import DynamicProfileData
from app.services import email_service, sms_service, users_service

_EMAIL_OTP_EXPIRY_MINUTES = 10
_EMAIL_OTP_RESEND_COOLDOWN_SECONDS = 30
_EMAIL_OTP_MAX_ATTEMPTS = 5


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _generate_otp_code() -> str:
    return str(random.randint(100000, 999999))


def validate_user(db: Session, *, email: str | None, mobile_number: str | None, password: str) -> User | None:
    user = users_service.find_by_email(db, email) if email else users_service.find_by_mobile_number(db, mobile_number)
    if user is None:
        return None
    return user if verify_password(password, user.password_hash) else None


def login(user: User) -> dict:
    return {"access_token": create_access_token(user), "user": user}


# Bumps the account's token_version so every previously-issued token -
# this device's and any other copy of it - stops passing get_current_user
# immediately (KNOWN_RISKS.md HIGH-2).
def logout(db: Session, user: User) -> None:
    user.token_version += 1
    db.flush()


# Citizen self-registration - no User row is created here. This only
# stages a PendingRegistration and sends its first OTP; the real account
# (and the first session for it) is only ever created by
# verify_registration_otp() below, on a correct code.
def register(db: Session, dto: RegisterRequest) -> dict:
    if dto.password != dto.confirm_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Passwords do not match")
    if dto.method == "EMAIL" and users_service.find_by_email(db, dto.email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    if dto.method == "MOBILE" and users_service.find_by_mobile_number(db, dto.mobile_number) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this mobile number already exists")

    # Re-registering with the same contact before finishing verification
    # isn't a conflict - no account exists yet, so this replaces whatever
    # unfinished attempt is on file rather than blocking a retry.
    existing_pending = (
        db.query(PendingRegistration).filter(PendingRegistration.email == dto.email).first()
        if dto.method == "EMAIL"
        else db.query(PendingRegistration).filter(PendingRegistration.mobile_number == dto.mobile_number).first()
    )
    if existing_pending:
        db.delete(existing_pending)
        db.flush()

    pending = PendingRegistration(
        name=dto.name, method=dto.method,
        email=dto.email if dto.method == "EMAIL" else None,
        mobile_number=dto.mobile_number if dto.method == "MOBILE" else None,
        password_hash=hash_password(dto.password),
    )
    db.add(pending)
    db.flush()

    target = dto.email if dto.method == "EMAIL" else dto.mobile_number

    # A failed OTP send (e.g. the SMS/email gateway isn't configured yet)
    # still leaves a real PendingRegistration on file - the citizen lands
    # on the OTP step and can Resend once delivery is actually working.
    try:
        _send_otp_for_pending_registration(db, pending, target)
    except HTTPException:
        pass

    return {"registration_id": pending.id, "method": dto.method, "target": target}


def _send_otp_for_pending_registration(db: Session, pending: PendingRegistration, target: str) -> None:
    now = _now()

    if pending.method == "MOBILE":
        if pending.otp_sent_at and (now - pending.otp_sent_at).total_seconds() < sms_service.RESEND_COOLDOWN_SECONDS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please wait before requesting another code")
        result = sms_service.send_otp(target)
        pending.otp_code_hash = result.code_hash
        pending.otp_expires_at = result.expires_at
        pending.otp_sent_at = result.sent_at
        pending.otp_attempts = 0
        db.flush()
        return

    if pending.otp_sent_at and (now - pending.otp_sent_at).total_seconds() < _EMAIL_OTP_RESEND_COOLDOWN_SECONDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please wait before requesting another code")

    code = _generate_otp_code()
    pending.otp_code_hash = hash_password(code)
    pending.otp_expires_at = now + timedelta(minutes=_EMAIL_OTP_EXPIRY_MINUTES)
    pending.otp_sent_at = now
    pending.otp_attempts = 0
    db.flush()

    email_service.send_otp_email(target, code)


def resend_registration_otp(db: Session, registration_id: UUID) -> None:
    pending = db.get(PendingRegistration, registration_id)
    if pending is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This registration has expired or was not found - please register again")
    target = pending.email if pending.method == "EMAIL" else pending.mobile_number
    _send_otp_for_pending_registration(db, pending, target)


# The only place a self-registered citizen's User row is actually
# created - a correct code here is what proves ownership of the contact
# method before any account exists at all.
def verify_registration_otp(db: Session, registration_id: UUID, code: str) -> dict:
    pending = db.get(PendingRegistration, registration_id)
    if pending is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This registration has expired or was not found - please register again")

    if pending.method == "MOBILE":
        valid, reason = sms_service.verify_otp(pending.otp_code_hash, pending.otp_expires_at, pending.otp_attempts, code)
        if not valid:
            if reason == "TOO_MANY_ATTEMPTS":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Too many incorrect attempts - request a new code")
            if reason == "WRONG_CODE":
                pending.otp_attempts += 1
                db.flush()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
    else:
        if pending.otp_attempts >= _EMAIL_OTP_MAX_ATTEMPTS:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Too many incorrect attempts - request a new code")
        if not pending.otp_code_hash or not pending.otp_expires_at or pending.otp_expires_at < _now():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
        if not verify_password(code, pending.otp_code_hash):
            pending.otp_attempts += 1
            db.flush()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

    user = users_service.create(
        db, email=pending.email if pending.method == "EMAIL" else None,
        mobile_number=pending.mobile_number if pending.method == "MOBILE" else None,
        password_hash=pending.password_hash, name=pending.name, role="CITIZEN",
        email_verified=pending.method == "EMAIL", mobile_verified=pending.method == "MOBILE",
    )
    db.delete(pending)
    db.flush()

    return login(user)


# Shared by registration, resend, and Profile add/change - `target` is
# whichever value actually needs a code sent to it right now.
def send_otp_for(db: Session, user: User, method: str, target: str) -> None:
    if method == "MOBILE":
        now = _now()
        if user.sms_otp_sent_at and (now - user.sms_otp_sent_at).total_seconds() < sms_service.RESEND_COOLDOWN_SECONDS:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please wait before requesting another code")

        # TextBee is send-only: sms_service returns the hashed code +
        # expiry so we persist it on the User row (same pattern as email OTP).
        result = sms_service.send_otp(target)
        user.sms_otp_code_hash = result.code_hash
        user.sms_otp_expires_at = result.expires_at
        user.sms_otp_sent_at = result.sent_at
        user.sms_otp_attempts = 0
        db.flush()
        return

    now = _now()
    if user.email_otp_sent_at and (now - user.email_otp_sent_at).total_seconds() < _EMAIL_OTP_RESEND_COOLDOWN_SECONDS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please wait before requesting another code")

    code = _generate_otp_code()
    user.email_otp_code_hash = hash_password(code)
    user.email_otp_expires_at = now + timedelta(minutes=_EMAIL_OTP_EXPIRY_MINUTES)
    user.email_otp_sent_at = now
    user.email_otp_attempts = 0
    db.flush()

    email_service.send_otp_email(target, code)


def resend_otp(db: Session, user: User, method: str) -> None:
    target = _target_value_for(user, method)
    if not target:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No {'email address' if method == 'EMAIL' else 'mobile number'} on file to verify")
    send_otp_for(db, user, method, target)


# Verifies whichever value is currently in flight for this method - the
# pending one if a change is in progress, otherwise the live one (covers
# both registration/first-add and later change-contact uniformly).
def verify_otp(db: Session, user: User, method: str, code: str) -> User:
    target = _target_value_for(user, method)
    if not target:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"No {'email address' if method == 'EMAIL' else 'mobile number'} to verify")

    if method == "MOBILE":
        valid, reason = sms_service.verify_otp(user.sms_otp_code_hash, user.sms_otp_expires_at, user.sms_otp_attempts, code)
        if not valid:
            if reason == "TOO_MANY_ATTEMPTS":
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Too many incorrect attempts - request a new code")
            if reason == "WRONG_CODE":
                user.sms_otp_attempts += 1
                db.flush()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

        user.sms_otp_code_hash = None
        user.sms_otp_expires_at = None
        user.sms_otp_attempts = 0
        if user.pending_mobile_number:
            user.mobile_number = user.pending_mobile_number
            user.pending_mobile_number = None
        user.mobile_verified = True
        db.flush()
        return user

    if user.email_otp_attempts >= _EMAIL_OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Too many incorrect attempts - request a new code")
    if not user.email_otp_code_hash or not user.email_otp_expires_at or user.email_otp_expires_at < _now():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")
    if not verify_password(code, user.email_otp_code_hash):
        user.email_otp_attempts += 1
        db.flush()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired code")

    if user.pending_email:
        user.email = user.pending_email
        user.pending_email = None
    user.email_verified = True
    user.email_otp_code_hash = None
    user.email_otp_expires_at = None
    user.email_otp_attempts = 0
    db.flush()
    return user


# Profile "add or change contact method": writes directly into email/
# mobile_number when that slot is empty (a first-time add), or stages
# into pending_email/pending_mobile_number when it's already set and
# verified (a change - the live value stays authoritative until the new
# one is confirmed).
def add_or_change_contact(db: Session, user: User, dto: ContactRequest) -> User:
    if dto.method == "EMAIL":
        value = dto.email
        if _email_taken_by_another_user(db, value, user.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already linked to another account")
        if user.email and user.email_verified:
            user.pending_email = value
        else:
            user.email = value
            user.email_verified = False
    else:
        value = dto.mobile_number
        if _mobile_taken_by_another_user(db, value, user.id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This mobile number is already linked to another account")
        if user.mobile_number and user.mobile_verified:
            user.pending_mobile_number = value
        else:
            user.mobile_number = value
            user.mobile_verified = False
    db.flush()

    # Same reasoning as register(): the contact value is already recorded
    # regardless of whether the OTP send itself succeeds.
    try:
        send_otp_for(db, user, dto.method, dto.email if dto.method == "EMAIL" else dto.mobile_number)
    except HTTPException:
        pass
    return user


def update_profile_details(db: Session, user: User, dto: DynamicProfileData) -> User:
    fields = dto.model_dump(exclude_unset=True, by_alias=False)
    for key, value in fields.items():
        if hasattr(user, key):
            setattr(user, key, value)
    db.flush()
    return user


def _target_value_for(user: User, method: str) -> str | None:
    return (user.pending_email or user.email) if method == "EMAIL" else (user.pending_mobile_number or user.mobile_number)


def _email_taken_by_another_user(db: Session, email: str, own_user_id: UUID) -> bool:
    existing = users_service.find_by_email(db, email)
    return existing is not None and existing.id != own_user_id


def _mobile_taken_by_another_user(db: Session, mobile_number: str, own_user_id: UUID) -> bool:
    existing = users_service.find_by_mobile_number(db, mobile_number)
    return existing is not None and existing.id != own_user_id
