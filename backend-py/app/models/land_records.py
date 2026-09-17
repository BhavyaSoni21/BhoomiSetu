"""Ported from backend/src/land-records/*.entity.ts.

Mock land record schemas for two states, deliberately structured
differently from each other to demonstrate the interoperability challenge
- two departments describing the same kind of thing with incompatible
field names and units. Nothing here references a parcel by foreign key on
purpose: resolving these to a canonical parcel by identifier (survey
number etc.) is InteroperabilityModule's job.
"""

import uuid

from sqlalchemy import Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class StateALandRecord(Base):
    """A rural/revenue-village style record."""

    __tablename__ = "state_a_land_records"
    __table_args__ = (Index("ix_state_a_land_records_survey_village", "survey_number", "village_code"),)

    record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_number: Mapped[str] = mapped_column(String(50))
    subdivision_number: Mapped[str] = mapped_column(String(20))
    owner_name: Mapped[str] = mapped_column(String(100))
    village_code: Mapped[str] = mapped_column(String(30))
    area_hectares: Mapped[float] = mapped_column(Numeric(10, 4))
    record_status: Mapped[str] = mapped_column(String(20), default="ACTIVE")


class StateBLandRecord(Base):
    """An urban plot-style record - different field names, different units
    (sqft vs hectares) than StateALandRecord, on purpose.
    """

    __tablename__ = "state_b_land_records"
    __table_args__ = (Index("ix_state_b_land_records_plot_locality", "plot_id", "locality_id"),)

    record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plot_id: Mapped[str] = mapped_column(String(50))
    holder_name: Mapped[str] = mapped_column(String(100))
    locality_id: Mapped[str] = mapped_column(String(30))
    land_extent_sqft: Mapped[float] = mapped_column(Numeric(12, 2))
    record_category: Mapped[str] = mapped_column(String(30))
