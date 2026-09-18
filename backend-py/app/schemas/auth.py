"""Ported from backend/src/auth/dto/*.dto.ts + auth.service.ts's
PublicUser/LoginResult/PendingRegistrationResult shapes.
"""

import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import EmailStr, Field, TypeAdapter, ValidationError, field_validator, model_validator

from app.schemas.base import CamelModel

_MOBILE_RE = re.compile(r"^[0-9]{10}$")
_PASSWORD_COMPLEXITY = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$")
_email_adapter = TypeAdapter(EmailStr)


def _is_valid_email(value: str) -> bool:
    try:
        _email_adapter.validate_python(value)
        return True
    except ValidationError:
        return False


class LoginRequest(CamelModel):
    """Accepts either identifier - exactly one is expected, but (matching
    the original) a request that somehow sends both isn't rejected, just
    not worth a stricter validator for an edge case with no real bad
    outcome.
    """

    email: str | None = None
    mobile_number: str | None = None
    password: str = Field(min_length=1)

    @model_validator(mode="after")
    def _validate_identifier(self):
        if not self.mobile_number and not (self.email and _is_valid_email(self.email)):
            raise ValueError("email must be a valid email address")
        if not self.email and not (self.mobile_number and _MOBILE_RE.match(self.mobile_number)):
            raise ValueError("mobileNumber must be a 10-digit Indian mobile number")
        return self


class RegisterRequest(CamelModel):
    name: str = Field(min_length=1)
    method: Literal["EMAIL", "MOBILE"]
    email: str | None = None
    mobile_number: str | None = None
    # KNOWN_RISKS.md MED-10: length alone let through e.g. 'aaaaaaaa'.
    password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=1)

    @field_validator("password")
    @classmethod
    def _check_complexity(cls, value: str) -> str:
        if not _PASSWORD_COMPLEXITY.match(value):
            raise ValueError("password must contain at least one uppercase letter, one lowercase letter, and one number")
        return value

    @model_validator(mode="after")
    def _validate_contact_for_method(self):
        if self.method == "EMAIL" and not (self.email and _is_valid_email(self.email)):
            raise ValueError("email is required and must be valid when method is EMAIL")
        if self.method == "MOBILE" and not (self.mobile_number and _MOBILE_RE.match(self.mobile_number)):
            raise ValueError("mobileNumber must be a 10-digit Indian mobile number when method is MOBILE")
        return self


class VerifyOtpRequest(CamelModel):
    method: Literal["EMAIL", "MOBILE"]
    code: str = Field(min_length=4, max_length=10)


class ResendOtpRequest(CamelModel):
    method: Literal["EMAIL", "MOBILE"]


class VerifyRegistrationOtpRequest(CamelModel):
    registration_id: UUID
    code: str = Field(min_length=4, max_length=10)


class ResendRegistrationOtpRequest(CamelModel):
    registration_id: UUID


class ContactRequest(CamelModel):
    method: Literal["EMAIL", "MOBILE"]
    email: str | None = None
    mobile_number: str | None = None

    @model_validator(mode="after")
    def _validate_contact_for_method(self):
        if self.method == "EMAIL" and not (self.email and _is_valid_email(self.email)):
            raise ValueError("email is required and must be valid when method is EMAIL")
        if self.method == "MOBILE" and not (self.mobile_number and _MOBILE_RE.match(self.mobile_number)):
            raise ValueError("mobileNumber must be a 10-digit Indian mobile number when method is MOBILE")
        return self


class ProfileDetailsRequest(CamelModel):
    name: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=300)
    government_id_number: str | None = Field(default=None, max_length=50)
    occupation: str | None = Field(default=None, max_length=100)
    preferred_language: str | None = Field(default=None, max_length=10)


class AuthPublicUserOut(CamelModel):
    """Never returns password_hash or OTP state - every response that
    carries a User goes through this. Distinct from
    app/schemas/user.py's PublicUserOut (UsersModule's own admin-listing
    shape, which has no address/government_id_number/occupation) -
    duplicated rather than shared across the module boundary, same
    convention as the original TS source.
    """

    id: UUID
    email: str | None
    mobile_number: str | None
    email_verified: bool
    mobile_verified: bool
    pending_email: str | None
    pending_mobile_number: str | None
    name: str
    role: str
    address: str | None
    government_id_number: str | None
    occupation: str | None
    preferred_language: str
    created_at: datetime
    # Google OAuth fields
    google_id: str | None = None
    google_picture: str | None = None
    google_email_verified: bool = False


class LoginResultOut(CamelModel):
    access_token: str
    user: AuthPublicUserOut


class PendingRegistrationResultOut(CamelModel):
    registration_id: UUID
    method: str
    target: str


class MessageOut(CamelModel):
    message: str


class OAuthLoginResponse(CamelModel):
    """Response for the Google OAuth login initiation endpoint."""
    auth_url: str
