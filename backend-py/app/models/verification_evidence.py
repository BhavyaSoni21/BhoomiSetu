"""A Verifier's field-visit evidence for one Workflow - geotagged photo +
timestamp + notes. Distinct from Workflow.evidence_* (a citizen's own
document attached at filing time) and from ParcelDocument (a parcel's
official land-record paperwork): this is specifically what an Authorized
Field Verifier captured on-site, reviewed by staff before a workflow step
is decided (see docs/SIH26014_Hidden_Insights_Strategy.md sections 2-4).
"""

import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class VerificationEvidence(Base):
    __tablename__ = "verification_evidence"
    __table_args__ = (Index("ix_verification_evidence_workflow_id", "workflow_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflows.id", ondelete="CASCADE"))
    # String, not a real FK - matches Workflow.citizen_id's existing
    # convention for cross-entity references in this codebase.
    verifier_id: Mapped[str] = mapped_column(String)

    photo_file_name: Mapped[str] = mapped_column(String)
    photo_file_path: Mapped[str] = mapped_column(String)
    mime_type: Mapped[str] = mapped_column(String(40))

    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    # Client-reported capture time - when the photo was actually taken on
    # site, which may differ from created_at (server receipt time) if the
    # upload happens moments later.
    captured_at: Mapped[datetime] = mapped_column()

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
