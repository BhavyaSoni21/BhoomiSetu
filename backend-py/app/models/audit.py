"""Ported from backend/src/audit/audit-log.entity.ts.

`parcel_id` is a pragmatic addition beyond the literal audit-log concept
(same as Parcel.cluster_id elsewhere in this schema) so GET
/parcels/:id/audit can index straight to it instead of parsing every
row's `metadata` JSON.
"""

import uuid
from datetime import datetime

from sqlalchemy import Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_entity_type_entity_id", "entityType", "entityId"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String, name="userId")
    user_role: Mapped[str] = mapped_column(String(30), name="userRole")
    # e.g. AUTH_LOGIN | WORKFLOW_STEP_APPROVED | WORKFLOW_STEP_REJECTED |
    # WORKFLOW_STATUS_CHANGED | GOVERNANCE_ALERT_STATUS_CHANGED
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40), name="entityType")  # USER | WORKFLOW | WORKFLOW_STEP | GOVERNANCE_ALERT
    entity_id: Mapped[str | None] = mapped_column(String, name="entityId", nullable=True)
    parcel_id: Mapped[str | None] = mapped_column(String, name="parcelId", nullable=True, index=True)
    metadata_json: Mapped[str | None] = mapped_column(Text, name="metadata", nullable=True)  # JSON-serialized

    created_at: Mapped[datetime] = mapped_column(name="createdAt", server_default=func.now())
