"""Ported from backend/src/historical-imagery/cluster-historical-snapshot.entity.ts.

One row per cluster per year - a small, fixed archive (~25 rows: 5
clusters x 5 years, 2022-2026), not one per parcel. `image_path` holds a
Supabase Storage object key (see app/common/supabase_storage.py) served
back through a route, not a local filesystem path - a hosted deployment's
filesystem doesn't survive a redeploy/restart.
"""

import uuid
from datetime import datetime

from sqlalchemy import Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ClusterHistoricalSnapshot(Base):
    __tablename__ = "cluster_historical_snapshots"
    __table_args__ = (Index("ix_cluster_historical_snapshots_cluster_year", "cluster_id", "year", unique=True),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cluster_id: Mapped[str] = mapped_column(String)
    year: Mapped[int] = mapped_column()
    image_path: Mapped[str] = mapped_column(String)
    # JSON-encoded {minLng, minLat, maxLng, maxLat} - stored as text rather
    # than four separate float columns, matching every other geo-adjacent
    # value in this codebase: nothing ever needs to run a numeric DB query
    # against this specific value, only read it back whole.
    bounds: Mapped[str] = mapped_column(String)

    generated_at: Mapped[datetime] = mapped_column(server_default=func.now())
