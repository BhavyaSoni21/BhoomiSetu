"""Ported from backend/src/admin/department.entity.ts.

Admin Portal "Department management" - display/admin metadata only. The
six mock department domain models (department_record.py) and the
ROLE_DEPARTMENT mapping (ported alongside AuthModule) keep working
independently of this - this table doesn't replace or feed into either.
`code` is expected to line up with those hardcoded department strings
(LAND_RECORDS, REGISTRATION, ...) so an admin editing "Land Records" here
is recognizably the same department elsewhere in the app, but nothing
enforces that at the database level.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
