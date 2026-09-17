"""Ported from backend/src/departments/*.entity.ts.

Six mock per-parcel department business records, each independent of the
others - `parcel_id` is a plain string matching Parcel.id by value, not a
foreign key/relation, standing in for independent department systems that
merely happen to reference the same identifier.
"""

import uuid
from datetime import date

from sqlalchemy import Boolean, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RegistrationRecord(Base):
    """Registration status, transaction records, registration history."""

    __tablename__ = "registration_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    registration_status: Mapped[str] = mapped_column(String(20))  # REGISTERED | PENDING | NOT_REGISTERED
    registration_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    registration_date: Mapped[date | None] = mapped_column(nullable=True)
    last_transaction_type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # SALE | GIFT | INHERITANCE | PARTITION
    last_transaction_date: Mapped[date | None] = mapped_column(nullable=True)


class PlanningRecord(Base):
    """Land use, zoning, master plan info. For the Pune cluster, land_use
    is generated consistent with which ZoningOverlay the parcel actually
    falls in, rather than being independently random.
    """

    __tablename__ = "planning_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    land_use: Mapped[str] = mapped_column(String(20))  # RESIDENTIAL | COMMERCIAL | AGRICULTURAL | MIXED_USE
    zoning_classification: Mapped[str] = mapped_column(String(40))
    master_plan_reference: Mapped[str] = mapped_column(String(60))
    building_permission_status: Mapped[str] = mapped_column(String(20), default="NOT_REQUIRED")  # APPROVED | PENDING | NOT_REQUIRED


class TaxRecord(Base):
    """Property tax, tax status, outstanding amount."""

    __tablename__ = "tax_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    assessed_value: Mapped[float] = mapped_column(Numeric(14, 2))
    annual_tax_amount: Mapped[float] = mapped_column(Numeric(10, 2))
    tax_status: Mapped[str] = mapped_column(String(20))  # PAID | PENDING | OVERDUE
    outstanding_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    last_payment_date: Mapped[date | None] = mapped_column(nullable=True)
    # Valuation reference - an independent market/circle-rate figure,
    # deliberately separate from assessed_value (the tax authority's own
    # figure).
    market_value_reference: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    valuation_date: Mapped[date | None] = mapped_column(nullable=True)
    valuation_source: Mapped[str | None] = mapped_column(String(60), nullable=True)  # e.g. CIRCLE_RATE | COMPARABLE_SALE


class RestrictionRecord(Base):
    """Environmental zones, protected areas, other restrictions - a
    per-parcel *business* record ("does the Restriction department have a
    flag on this parcel?"), distinct from spatial.RestrictionZone which is
    the GIS overlay *polygon*. For Pune, has_restriction is set consistent
    with membership in the flood RestrictionZone's affected_parcel_ids.
    """

    __tablename__ = "restriction_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    has_restriction: Mapped[bool] = mapped_column(Boolean, default=False)
    restriction_type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # ENVIRONMENTAL | PROTECTED_AREA | FLOOD_PRONE
    restriction_details: Mapped[str | None] = mapped_column(String(200), nullable=True)
    imposing_authority: Mapped[str | None] = mapped_column(String(60), nullable=True)


class DisputeRecord(Base):
    """The fifth workflow type named in the SIH problem statement's
    required interoperable-workflow list. Mirrors RestrictionRecord's
    shape: a per-parcel business record keyed by a plain parcel_id string.
    """

    __tablename__ = "dispute_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    has_active_dispute: Mapped[bool] = mapped_column(Boolean, default=False)
    dispute_type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # OWNERSHIP | BOUNDARY | INHERITANCE | ENCROACHMENT
    case_status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # FILED | UNDER_REVIEW | RESOLVED | DISMISSED
    filing_date: Mapped[date | None] = mapped_column(nullable=True)
    resolution_date: Mapped[date | None] = mapped_column(nullable=True)
    resolution_summary: Mapped[str | None] = mapped_column(String(200), nullable=True)


class EncumbranceRecord(Base):
    """A required "essential layer" of the fuller "Land Stack" problem
    statement. Mirrors DisputeRecord's shape: a per-parcel business record
    keyed by a plain parcel_id string.
    """

    __tablename__ = "encumbrance_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    has_encumbrance: Mapped[bool] = mapped_column(Boolean, default=False)
    encumbrance_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # MORTGAGE | LIEN | CHARGE
    lender_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    instrument_reference: Mapped[str | None] = mapped_column(String(60), nullable=True)
    registered_date: Mapped[date | None] = mapped_column(nullable=True)
    discharge_date: Mapped[date | None] = mapped_column(nullable=True)
