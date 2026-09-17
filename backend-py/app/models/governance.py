"""Ported from backend/src/governance/governance-alert.entity.ts.

The officer-facing output of the AI / change-detection pipeline. Seeded
from spatial/tax data seed.ts already computes (restriction-zone overlap,
the simulated change-detection event, overdue tax) rather than hand-picked
- standing in for the real spatial-intersection + LLM-explanation pipeline
until GovernanceModule builds it for real.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GovernanceAlert(Base):
    __tablename__ = "governance_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    # RESTRICTION_ZONE_OVERLAP | UNAUTHORIZED_CHANGE_DETECTED | TAX_OVERDUE |
    # DISPUTE_DETECTED | RESTRICTION_DETECTED
    alert_type: Mapped[str] = mapped_column(String(40))
    severity: Mapped[str] = mapped_column(String(20))  # LOW | MEDIUM | HIGH | CRITICAL
    source: Mapped[str] = mapped_column(String(40))  # RESTRICTION_MONITOR | CHANGE_DETECTION | TAX_MONITOR | HISTORICAL_IMAGERY

    # Four verification stages: OPEN (detected) -> ACKNOWLEDGED ->
    # FIELD_VERIFIED -> RESOLVED, with DISMISSED reachable from any of the
    # first three as an early-exit for a false alarm. Enforced as a linear
    # progression by the governance-alerts service's own VALID_TRANSITIONS
    # map - a flat status column advancing through values, not a
    # child-steps table (that's for *parallel per-department* steps, a
    # different concept that doesn't fit a single-department alert).
    status: Mapped[str] = mapped_column(String(20), default="OPEN")  # OPEN | ACKNOWLEDGED | FIELD_VERIFIED | RESOLVED | DISMISSED

    explanation: Mapped[str] = mapped_column(Text)
    # The officer's own reason for reviewing/dismissing this alert.
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class GovernanceRule(Base):
    """Admin-editable governance rule configuration.

    Each rule defines a condition that, when met, creates a GovernanceAlert.
    Rules are scoped by alert_type and can be enabled/disabled by admins.
    """

    __tablename__ = "governance_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_type: Mapped[str] = mapped_column(String(40), index=True)  # e.g., RESTRICTION_ZONE_OVERLAP
    # Human-readable name for the admin UI
    name: Mapped[str] = mapped_column(String(100))
    # Description of what this rule checks
    description: Mapped[str] = mapped_column(Text)
    # JSON configuration for the rule's condition logic
    condition_config: Mapped[str] = mapped_column(Text)  # JSON with rule-specific params
    # Default severity when this rule triggers
    default_severity: Mapped[str] = mapped_column(String(20), default="MEDIUM")  # LOW | MEDIUM | HIGH | CRITICAL
    # Default explanation template (can use {placeholders})
    explanation_template: Mapped[str] = mapped_column(Text)
    # Whether this rule is active
    is_active: Mapped[bool] = mapped_column(default=True)
    # Department this rule belongs to (for routing notifications)
    department: Mapped[str | None] = mapped_column(String(40), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
