"""Ported from backend/src/users/users.controller.ts's `toPublicUser` +
dto/user.dto.ts.
"""

import re
from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field, field_validator

from app.auth.roles import ALL_STAFF_ROLES
from app.schemas.base import CamelModel

_PASSWORD_COMPLEXITY = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$")


class PublicUserOut(CamelModel):
    """Never includes password_hash - mirrors toPublicUser, duplicated
    rather than shared across the UsersModule/AuthModule boundary (same
    convention as this codebase's other small cross-module overlaps).
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
    created_at: datetime


class CreateUser(CamelModel):
    email: EmailStr
    # KNOWN_RISKS.md MED-10, same rule as citizen self-registration -
    # officer/admin accounts are admin-created through this schema, not
    # exempt from the same baseline.
    password: str = Field(min_length=8)
    name: str
    role: str

    @field_validator("password")
    @classmethod
    def _check_complexity(cls, value: str) -> str:
        if not _PASSWORD_COMPLEXITY.match(value):
            raise ValueError("password must contain at least one uppercase letter, one lowercase letter, and one number")
        return value

    @field_validator("role")
    @classmethod
    def _check_role(cls, value: str) -> str:
        if value not in ALL_STAFF_ROLES:
            raise ValueError(f"role must be one of {ALL_STAFF_ROLES}")
        return value


class UpdateUserRole(CamelModel):
    role: str

    @field_validator("role")
    @classmethod
    def _check_role(cls, value: str) -> str:
        if value not in ALL_STAFF_ROLES:
            raise ValueError(f"role must be one of {ALL_STAFF_ROLES}")
        return value
