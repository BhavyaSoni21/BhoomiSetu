"""Ported from backend/src/spatial/*.entity.ts.

Geometry columns use real PostGIS Geometry (GeoAlchemy2) rather than the
TS entities' `geometry: text` GeoJSON string - see app/models/parcel.py's
module docstring for why. `*_parcel_ids` columns use Postgres's native
ARRAY type rather than TypeORM's `simple-array` (a comma-joined text
column - a SQLite-portability hack backend-py has no reason to keep).
"""

import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from geoalchemy2.elements import WKBElement
from sqlalchemy import String, Text, func, SmallInteger
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ZoningOverlay(Base):
    """Land-use zoning polygon (residential / commercial / agricultural)
    used to demonstrate zoning analysis over a parcel cluster.
    """

    __tablename__ = "zoning_overlays"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    zone_type: Mapped[str] = mapped_column(String(30))  # RESIDENTIAL | COMMERCIAL | AGRICULTURAL
    proposed_land_use: Mapped[str | None] = mapped_column(String(50), nullable=True)
    proposed_effective_year: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326))
    parcel_ids: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)  # parcels this overlay covers

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class RestrictionZone(Base):
    """Restriction polygon (e.g. flood-prone area) that crosses parcel
    boundaries, used to demonstrate spatial-intersection queries ("which
    parcels does this restriction affect?").
    """

    __tablename__ = "restriction_zones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    restriction_type: Mapped[str] = mapped_column(String(30))  # FLOOD | ENVIRONMENTAL | PROTECTED_AREA
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326))
    affected_parcel_ids: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class InfrastructureFeature(Base):
    """Mock infrastructure (roads, utility lines) near a parcel cluster,
    used to demonstrate proximity queries ("which parcels are near this
    road?").
    """

    __tablename__ = "infrastructure_features"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    feature_type: Mapped[str] = mapped_column(String(30))  # ROAD | WATER_LINE | ELECTRICITY
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    # LineString or Point depending on feature_type - kept generic rather
    # than a single fixed geometry_type.
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="GEOMETRY", srid=4326))

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class AdminMapNote(Base):
    """Admin-only map annotation - unlike ZoningOverlay/RestrictionZone/
    InfrastructureFeature (public reference data, read by anyone), every
    endpoint for this entity is ADMIN-only, including reads - it simply
    doesn't exist for a citizen or officer session. General-purpose
    (Point/LineString/Polygon), not domain-typed like the other three,
    since its purpose is free-form internal tracking, not a fixed
    category.
    """

    __tablename__ = "admin_map_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="GEOMETRY", srid=4326))
    # Plain string, no FK - same convention as the department-record
    # models' parcel_id.
    created_by_user_id: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ChangeDetectionEvent(Base):
    """Simulated output of a satellite change-detection pass: a "changed
    region" polygon plus the parcels it was generated to intersect. Stands
    in for the real pipeline (imagery diff -> changed region -> spatial
    intersection -> affected parcels -> governance alert).
    """

    __tablename__ = "change_detection_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    description: Mapped[str] = mapped_column(Text)
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326))
    affected_parcel_ids: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)

    detected_at: Mapped[datetime] = mapped_column(server_default=func.now())
