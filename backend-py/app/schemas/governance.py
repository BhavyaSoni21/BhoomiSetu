"""Ported from backend/src/governance/governance-alert.entity.ts +
dto/governance-alert.dto.ts.
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
