"""Ported from backend/src/audit/audit.service.ts's `AuditLogView`."""

import json
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import CamelModel


class AuditLogOut(CamelModel):
    id: UUID
    user_id: str
    user_role: str
    action: str
    entity_type: str
    entity_id: str | None
    parcel_id: str | None
    # §58 case-linked audit trail fields (optional; populated for case mutations).
    case_id: str | None = None
    task_id: str | None = None
    reason: str | None = None
    previous_value: dict[str, Any] | str | None = None
    new_value: dict[str, Any] | str | None = None
    # Stored as `metadata_json` (raw JSON text) on the model - `metadata` is
    # reserved on SQLAlchemy's declarative Base - parsed back into an object
    # here, matching AuditLogView's `metadata: Record<string, unknown> | null`.
    metadata: dict[str, Any] | None = Field(validation_alias="metadata_json")
    created_at: datetime

    @field_validator("metadata", "previous_value", "new_value", mode="before")
    @classmethod
    def _parse_metadata(cls, value):
        if value is None or isinstance(value, (dict, list)):
            return value
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return value
