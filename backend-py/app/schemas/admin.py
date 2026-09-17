"""Ported from backend/src/admin/department.entity.ts +
dto/department.dto.ts.
"""

from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.base import CamelModel


class DepartmentOut(CamelModel):
    id: UUID
    code: str
    name: str
    description: str | None
    contact_email: str | None
    contact_phone: str | None
    created_at: datetime
    updated_at: datetime


class CreateDepartment(CamelModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=300)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=30)


class UpdateDepartment(CamelModel):
    """`code` is intentionally not editable here - it's the stable
    identifier the department is looked up/audited by.
    """

    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=300)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=30)
