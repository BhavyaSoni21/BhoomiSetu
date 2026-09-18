"""Dynamic profile fields configuration - allows admins to configure
what fields appear in user profiles without code changes.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProfileField(Base):
    """Configuration for a single profile field. Admins can add/remove/
    modify fields without code changes. Fields are role-scoped so
    citizens see different fields than officers.
    """

    __tablename__ = "profile_fields"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    field_name: Mapped[str] = mapped_column(String(50), unique=True)
    field_label: Mapped[str] = mapped_column(String(100))
    field_type: Mapped[str] = mapped_column(String(20))  # text, email, mobile, select, date, number, textarea
    field_options: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # for select fields: {options: [...]}
    is_required: Mapped[bool] = mapped_column(default=False)
    is_editable: Mapped[bool] = mapped_column(default=True)
    display_order: Mapped[int] = mapped_column(default=0)
    roles: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)  # which roles this field applies to
    validation_regex: Mapped[str | None] = mapped_column(String(200), nullable=True)
    help_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())