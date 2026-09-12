"""Ported from backend/src/notifications/sms.service.ts.

SMS OTP delivery via TextBee (textbee.dev) - uses an Android phone as
the SMS gateway. TextBee is a *send-only* gateway (no server-side OTP
verification), so this generates the code + bcrypt hash here and
returns both to the caller (auth_service), which stores the hash on the
User row and checks it later - exactly the same pattern as
email_service/email OTP.

Same "unset config -> 503 at call time" pattern as groq_service/
gemini_service: if TEXTBEE_API_KEY is blank, every send_otp() call
raises and the caller (auth_service.register/resend_otp) swallows it -
registration still succeeds, the citizen just can't verify mobile until
the gateway is configured.

Module-level functions, not a class - matching this codebase's
established convention for external-API wrappers (groq_service,
gemini_service, narrative_service), so tests can monkeypatch
send_otp/verify_otp directly.
"""

import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import HTTPException, status

from app.auth.passwords import hash_password, verify_password
from app.config import get_settings

_OTP_EXPIRY_MINUTES = 10
_OTP_RESEND_COOLDOWN_SECONDS = 30
_OTP_MAX_ATTEMPTS = 5
_TEXTBEE_API_URL = "https://api.textbee.dev/api/v1/gateway/send-sms"


@dataclass
class SmsOtpResult:
    code_hash: str
    expires_at: datetime
    sent_at: datetime


def is_configured() -> bool:
    settings = get_settings()
    return bool(settings.textbee_api_key and settings.textbee_device_id)


RESEND_COOLDOWN_SECONDS = _OTP_RESEND_COOLDOWN_SECONDS


# Returns the hashed code + metadata for auth_service to persist on the
# User row. The raw code is sent via TextBee but never persisted.
def send_otp(mobile_number: str) -> SmsOtpResult:
    settings = get_settings()
    if not is_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="SMS delivery is not configured (TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID is not set)")

    code = _generate_code()
    sent_at = datetime.now(timezone.utc).replace(tzinfo=None)
    expires_at = sent_at + timedelta(minutes=_OTP_EXPIRY_MINUTES)
    code_hash = hash_password(code)

    message = f"BhoomiSetu login code: {code}. Expires in {_OTP_EXPIRY_MINUTES} minutes."

    try:
        response = httpx.post(
            _TEXTBEE_API_URL,
            headers={"x-api-key": settings.textbee_api_key, "Content-Type": "application/json"},
            json={"deviceId": settings.textbee_device_id, "simSubscriptionId": int(settings.textbee_sim_subscription_id), "recipients": [mobile_number], "message": message},
            timeout=10.0,
        )
    except httpx.HTTPError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"SMS delivery failed ({error})") from error

    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=f"SMS delivery failed (TextBee HTTP {response.status_code})")

    return SmsOtpResult(code_hash=code_hash, expires_at=expires_at, sent_at=sent_at)


# Pure local verification - no network call needed since we own the hash.
# auth_service calls this with values from the User row after loading it.
def verify_otp(stored_hash: str | None, stored_expires_at: datetime | None, attempts: int, code: str) -> tuple[bool, str | None]:
    """Returns (valid, reason) where reason is one of EXPIRED |
    TOO_MANY_ATTEMPTS | WRONG_CODE | None (when valid).
    """
    if attempts >= _OTP_MAX_ATTEMPTS:
        return False, "TOO_MANY_ATTEMPTS"
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if not stored_hash or not stored_expires_at or stored_expires_at < now:
        return False, "EXPIRED"
    if not verify_password(code, stored_hash):
        return False, "WRONG_CODE"
    return True, None


def _generate_code() -> str:
    return str(random.randint(100000, 999999))
