"""Ported from backend/src/governance/governance-alert.entity.ts +
dto/governance-alert.dto.ts.

Also includes admin-editable GovernanceRule configuration (BACKLOG.md #4).
"""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel


class GovernanceAlertOut(CamelModel):
    id: UUID
    parcel_id: str
    alert_type: str
    severity: str
    source: str
    status: str
    explanation: str
    reason: str | None
    created_at: datetime
    department: str | None = None


class UpdateGovernanceAlertStatus(CamelModel):
    # OPEN excluded on purpose - an alert starts there and can never be
    # PATCHed back to it (governance_alerts_service.update_status's
    # VALID_TRANSITIONS enforces the actual reachable-from-current-stage set).
    status: Literal["ACKNOWLEDGED", "FIELD_VERIFIED", "RESOLVED", "DISMISSED"]
    # Mandatory: an officer marking an alert reviewed or dismissing it must
    # always record why - enforced here (400 without one), not just
    # hidden/disabled in the UI.
    reason: str = Field(min_length=1)


class GovernanceRuleOut(CamelModel):
    id: UUID
    alert_type: str
    name: str
    description: str
    condition_config: str  # JSON string
    default_severity: str
    explanation_template: str
    is_active: bool
    department: str | None
    created_at: datetime
    updated_at: datetime


class CreateGovernanceRule(CamelModel):
    alert_type: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1)
    condition_config: str = Field(min_length=1)  # JSON string
    default_severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = "MEDIUM"
    explanation_template: str = Field(min_length=1)
    is_active: bool = True
    department: str | None = None


class UpdateGovernanceRule(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, min_length=1)
    condition_config: str | None = Field(default=None, min_length=1)
    default_severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = None
    explanation_template: str | None = Field(default=None, min_length=1)
    is_active: bool | None = None
    department: str | None = None
