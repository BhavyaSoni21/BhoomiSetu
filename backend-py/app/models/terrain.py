"""Terrain/Infrastructure models from Earth Engine data.
PostGIS Geometry columns with GIST spatial indexes for fast spatial queries.
"""

import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from geoalchemy2.elements import WKBElement
from sqlalchemy import ForeignKey, Integer, Numeric, String, Text, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RoadNetwork(Base):
    """Road network from OpenStreetMap (via EE's OSM dataset).
    Used for parcel generation constraints: avoid subdividing across major roads,
    snap parcel boundaries to road edges, compute road access distance.
    """

    __tablename__ = "road_networks"
    __table_args__ = (
        UniqueConstraint("osm_id", "state_code", "district", name="uq_road_network_osm_id_district"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    osm_id: Mapped[int] = mapped_column(Integer, index=True)  # OSM way ID
    name: Mapped[str] = mapped_column(String(200))
    road_type: Mapped[str] = mapped_column(String(30), index=True)  # HIGHWAY|PRIMARY|SECONDARY|TERTIARY|RESIDENTIAL|TRACK|SERVICE|UNCLASSIFIED
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="LINESTRING", srid=4326, spatial_index=True))
    source: Mapped[str] = mapped_column(String(30))  # OSM|GOOGLE_ROADS|SURVEY
    osm_tags: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # full OSM tags (oneway, lanes, maxspeed, surface, etc.)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class BuildingFootprint(Base):
    """Building footprints from Microsoft Global Building Footprints or Google Open Buildings.
    Used for: building density analysis, parcel generation constraints (don't place parcels on buildings),
    urban/rural classification, population estimation.
    """

    __tablename__ = "building_footprints"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    building_type: Mapped[str] = mapped_column(String(30), index=True)  # RESIDENTIAL|COMMERCIAL|INDUSTRIAL|AGRICULTURAL|UNKNOWN
    height_m: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    confidence: Mapped[float] = mapped_column(Numeric(3, 2))  # 0-1 from MS Buildings
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True))
    source: Mapped[str] = mapped_column(String(30))  # MS_BUILDINGS|GOOGLE_OPEN_BUILDINGS|OSM
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class LandCover(Base):
    """Land cover classification from ESA WorldCover (10m) or Dynamic World (10m, annual).
    Used for: parcel generation constraints (no parcels on water/wetland), land use validation,
    agricultural vs urban classification, change detection masking.
    """

    __tablename__ = "land_cover"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    class_code: Mapped[int] = mapped_column(Integer, index=True)  # ESA: 10=Tree,20=Shrub,30=Grass,40=Crop,50=Built,60=Water,70=Wetland,80=Moss,90=Bare,95=Snow
    class_name: Mapped[str] = mapped_column(String(50), index=True)
    year: Mapped[int] = mapped_column(Integer, index=True)
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True))
    source: Mapped[str] = mapped_column(String(30))  # ESA_WORLDCOVER|DYNAMIC_WORLD|SENTINEL2_CLASSIFIED
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ElevationTile(Base):
    """Pre-computed elevation/slope tiles from COPERNICUS DEM 30m (or SRTM/NASADEM).
    One tile per cluster/district bounds. Used for: slope constraints, flood risk, terrain analysis.
    """

    __tablename__ = "elevation_tiles"
    __table_args__ = (
        UniqueConstraint("state_code", "district", name="uq_elevation_tile_state_district"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    min_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    max_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    mean_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    mean_slope_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    max_slope_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    slope_histogram: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {slope_range_deg: percentage}
    state_code: Mapped[str] = mapped_column(String(10), index=True)
    district: Mapped[str] = mapped_column(String(40), index=True)
    geometry: Mapped[WKBElement] = mapped_column(Geometry(geometry_type="POLYGON", srid=4326, spatial_index=True))
    source: Mapped[str] = mapped_column(String(30))  # COPERNICUS_DEM_30M|SRTM30|NASADEM
    ee_asset_id: Mapped[str | None] = mapped_column(String(200), nullable=True)  # EE asset reference if exported
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class ParcelTerrainProfile(Base):
    """Materialized per-parcel terrain profile computed via PostGIS spatial joins.
    Updated by batch Celery task after terrain data ingestion.
    Used by: parcel generation constraints, 360° view, analytics, API responses.
    """

    __tablename__ = "parcel_terrain_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    parcel_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("parcels.id", ondelete="CASCADE"),
        unique=True,
        index=True
    )

    # Elevation
    mean_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    min_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    max_elevation_m: Mapped[float] = mapped_column(Numeric(8, 2))
    elevation_range_m: Mapped[float] = mapped_column(Numeric(8, 2))

    # Slope
    mean_slope_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    max_slope_deg: Mapped[float] = mapped_column(Numeric(5, 2))
    steep_slope_percentage: Mapped[float] = mapped_column(Numeric(5, 2))  # % area > 15 deg

    # Land cover
    dominant_land_cover: Mapped[str] = mapped_column(String(50))
    land_cover_mix: Mapped[dict] = mapped_column(JSON)  # {class_name: percentage_of_parcel_area}

    # Infrastructure proximity
    nearest_road_distance_m: Mapped[float] = mapped_column(Numeric(10, 2))
    nearest_road_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    road_access_score: Mapped[float] = mapped_column(Numeric(3, 2))  # 0-1: 1 = direct highway access

    # Buildings
    building_count: Mapped[int] = mapped_column(Integer, default=0)
    building_coverage_percentage: Mapped[float] = mapped_column(Numeric(5, 2))  # % parcel area covered by buildings
    building_density_per_ha: Mapped[float] = mapped_column(Numeric(6, 2))

    # Risk/Constraints (boolean flags + composite score)
    flood_risk_score: Mapped[float] = mapped_column(Numeric(3, 2))  # 0-1
    constraints: Mapped[dict] = mapped_column(JSON)  # {"water_body": bool, "wetland": bool, "steep_slope": bool, "protected_area": bool, "flood_zone": bool, "building_footprint": bool}
