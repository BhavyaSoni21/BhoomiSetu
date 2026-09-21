"""Ported from backend/src/parcels/*.entity.ts.

Geometry columns use GeoAlchemy2's real PostGIS Geometry type rather than
the TS entities' `geometry: text` (raw GeoJSON string) - PYTHON_MIGRATION_PLAN.md
§1's whole reason for this migration is real spatial analysis instead of
hand-rolled query strings, and backend-py has no SQLite driver to keep a
text-column fallback for. SRID 4326 (WGS84 lng/lat) throughout, matching
the [lng, lat] GeoJSON convention every existing geometry value already uses.
"""

import uuid
from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Parcel(Base):
    __tablename__ = "parcels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    canonical_parcel_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Identifies the connected cadastral network (e.g. "MH-PUNE-01") a
    # parcel's geometry was generated as part of - null for parcels not
    # seeded as part of a cluster. See ParcelNeighbour for explicit
    # touching/nearby edges.
    cluster_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    ulpin: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    state_code: Mapped[str] = mapped_column(String(10))
    district_code: Mapped[str] = mapped_column(String(20))
    local_body_code: Mapped[str] = mapped_column(String(20))

    geometry: Mapped[object] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=False))
    area_sq_m: Mapped[float] = mapped_column(Numeric(15, 2))

    street_address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    locality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    landmark: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pincode: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Current state snapshot (§41) — quick-access summary of current
    # values across domains (tax, dispute, encumbrance, restriction,
    # survey, registration). Full history lives in OwnershipHistoryRecord,
    # ParcelHistoricalState, and the department_record_* tables.
    # Never overwritten — new values go into history tables first.
    current_state: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    identifiers: Mapped[list["ParcelIdentifier"]] = relationship(back_populates="parcel", cascade="all, delete-orphan")

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())


class ParcelIdentifier(Base):
    __tablename__ = "parcel_identifiers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parcels.id", ondelete="CASCADE"))
    parcel: Mapped["Parcel"] = relationship(back_populates="identifiers")

    # e.g. ULPIN | SURVEY_NUMBER | PLOT_NUMBER | LOCAL_PARCEL_ID
    identifier_type: Mapped[str] = mapped_column(String(50), index=True)
    identifier_value: Mapped[str] = mapped_column(String(100), index=True)
    source_state: Mapped[str] = mapped_column(String(10))  # state that issued this identifier
    source_department: Mapped[str] = mapped_column(String(50))  # department that issued this identifier


class ParcelNeighbour(Base):
    """Explicit, precomputed spatial relationship between two parcels -
    generated at seed time from known cluster-subdivision adjacency
    (reliable) rather than derived live from geometry on every request.
    Stored bidirectionally: selecting either parcel finds the relationship
    with a single parcel_id = :id lookup.
    """

    __tablename__ = "parcel_neighbours"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    neighbour_parcel_id: Mapped[str] = mapped_column(String)
    relationship_type: Mapped[str] = mapped_column(String(20))  # TOUCHING | NEARBY


class CitizenParcel(Base):
    """Links a citizen's login (User.role == 'CITIZEN') to the parcels
    associated with their account for the "My Parcels" dashboard.
    Deliberately a separate join entity rather than an owner_id column on
    Parcel, so this stays independent of the unrelated StateALandRecord/
    StateBLandRecord "ownerName"/"holderName" text fields. One-parcel-one-
    citizen is a real DB-level invariant (the unique index below), not
    just a seed-time convention.
    """

    __tablename__ = "citizen_parcels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    citizen_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    parcel_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("parcels.id", ondelete="CASCADE"), unique=True)
    status: Mapped[str] = mapped_column(String(30), default="Registered")  # Registered | Pending Verification | Rejected
    local_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    verification_report: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ParcelDocument(Base):
    """A parcel's real, persisted land-property paperwork (e.g. a Record
    of Rights copy). Seeded deliberately partial/messy - not every
    citizen-linked parcel has one, and of those that do, a mix of
    REGISTERED/UNREGISTERED status exists from the start, exactly like a
    real system that's been in use rather than freshly pristine.
    """

    __tablename__ = "parcel_documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    document_type: Mapped[str] = mapped_column(String(40), default="ROR_COPY")
    file_name: Mapped[str] = mapped_column(String)
    file_path: Mapped[str] = mapped_column(String)
    mime_type: Mapped[str] = mapped_column(String(40), default="image/png")
    # OCR'd once at seed time (or when a bare row is created on workflow
    # approval) rather than re-OCRing on every request - reused as the
    # automatic pre-check shown to the reviewing officer.
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    registration_status: Mapped[str] = mapped_column(String(20), default="UNREGISTERED")  # REGISTERED | UNREGISTERED

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class OwnershipHistoryRecord(Base):
    """A parcel's chain of past owners - sits behind the current-owner
    fields State A/B land records already expose, not a replacement for
    them. Multiple rows per parcel, ordered by transaction_date; the most
    recent entry corresponds to the owner already recorded there.
    """

    __tablename__ = "ownership_history_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    owner_name: Mapped[str] = mapped_column(String(100))
    transaction_type: Mapped[str] = mapped_column(String(20))  # ORIGINAL | SALE | GIFT | INHERITANCE | PARTITION
    transaction_date: Mapped[date] = mapped_column()
    document_reference: Mapped[str | None] = mapped_column(String(60), nullable=True)
    # The village-record account/holding number this ownership entry is
    # filed under (Form 7's "Khata No.") - a real Indian land-record concept
    # with no prior column here; added for the official document PDF
    # (BACKLOG.md item 14 follow-up). Nullable: older/synthetic rows never
    # had one assigned, same convention as document_reference above.
    khata_number: Mapped[str | None] = mapped_column(String(20), nullable=True)


class CropRecord(Base):
    """A parcel's crop register (Form 12's "Register of Crops") - only
    ever seeded for AGRICULTURAL-land-use parcels (see PlanningRecord),
    since a residential/commercial parcel genuinely has no crop history.
    Multiple rows per parcel (one per year/season), added for the official
    document PDF (BACKLOG.md item 14 follow-up).
    """

    __tablename__ = "crop_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    agricultural_year: Mapped[str] = mapped_column(String(10))  # e.g. "2024-25"
    season: Mapped[str] = mapped_column(String(20))  # KHARIF | RABI | SUMMER
    crop_type: Mapped[str] = mapped_column(String(30))  # FOOD_CROP | CASH_CROP | HORTICULTURE
    crop_name: Mapped[str] = mapped_column(String(60))
    irrigated_area_sq_m: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    unirrigated_area_sq_m: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    irrigation_source: Mapped[str | None] = mapped_column(String(30), nullable=True)  # WELL | CANAL | BOREWELL | RAINFED
    uncultivable_area_sq_m: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    remark: Mapped[str | None] = mapped_column(String(120), nullable=True)


class ParcelHistoricalState(Base):
    """Attribute-level history, per year, deliberately NOT geometry (the
    parcel's boundary shape is never re-versioned - only the values other
    tabs already show today, snapshotted per year). Built as the
    prerequisite for the historical parcel-imagery comparison feature: a
    cluster snapshot showing a parcel visually changed in year Y is only
    "unauthorized" if this table has no matching recorded attribute change
    for that parcel/year.
    """

    __tablename__ = "parcel_historical_states"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[str] = mapped_column(String, index=True)
    year: Mapped[int] = mapped_column(index=True)
    land_use: Mapped[str | None] = mapped_column(String(40), nullable=True)
    zoning_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    restriction_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tax_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
