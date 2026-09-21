"""Ported from backend/src/audit/audit-log.entity.ts.

`parcel_id` is a pragmatic addition beyond the literal audit-log concept
(same as Parcel.cluster_id elsewhere in this schema) so GET
/parcels/:id/audit can index straight to it instead of parsing every
row's `metadata` JSON.

Extended for §58 case-linked audit trail: `case_id`, `task_id`,
`decision_id`, `previous_value`, `new_value` columns added so every
authorized DB change is traceable to the originating case/task.
"""

import uuid
from datetime import datetime

from sqlalchemy import Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_entity_type_entity_id", "entity_type", "entity_id"),
        Index("ix_audit_logs_case_id", "case_id"),
        Index("ix_audit_logs_task_id", "task_id"),
        Index("ix_audit_logs_decision_id", "decision_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String)
    user_role: Mapped[str] = mapped_column(String(30))
    # e.g. AUTH_LOGIN | WORKFLOW_STEP_APPROVED | CASE_STATUS_CHANGED |
    # TASK_ADVANCED | DECISION_APPROVED | DATABASE_UPDATED | ...
    action: Mapped[str] = mapped_column(String(60))
    entity_type: Mapped[str] = mapped_column(String(40))  # USER | CASE | DEPARTMENT_TASK | WORKFLOW | GOVERNANCE_ALERT | ...
    entity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    parcel_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)

    # Case-linked audit trail (§58)
    case_id: Mapped[str | None] = mapped_column(String, nullable=True)
    task_id: Mapped[str | None] = mapped_column(String, nullable=True)
    decision_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # Value change tracking (§58): JSON-serialized previous and new values
    # for database mutations. E.g. {"owner_name": "Before"} → {"owner_name": "After"}.
    previous_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Human-readable explanation for the change (§58)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON-serialized

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
