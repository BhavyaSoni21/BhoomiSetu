"""add_terrain_tables

Revision ID: a1b2c3d4e5f6
Revises: 52414ccf0713
Create Date: 2026-09-18 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects.postgresql import UUID, JSON

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '52414ccf0713'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # road_networks
    op.create_table(
        'road_networks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('road_type', sa.String(30), nullable=False, index=True),
        sa.Column('state_code', sa.String(10), nullable=False, index=True),
        sa.Column('district', sa.String(40), nullable=False, index=True),
        sa.Column('geometry', geoalchemy2.Geometry(geometry_type='LINESTRING', srid=4326, spatial_index=True), nullable=False),
        sa.Column('source', sa.String(30), nullable=False),
        sa.Column('osm_tags', JSON, nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    # building_footprints
    op.create_table(
        'building_footprints',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('building_type', sa.String(30), nullable=False, index=True),
        sa.Column('height_m', sa.Numeric(6, 2), nullable=True),
        sa.Column('confidence', sa.Numeric(3, 2), nullable=False),
        sa.Column('state_code', sa.String(10), nullable=False, index=True),
        sa.Column('district', sa.String(40), nullable=False, index=True),
        sa.Column('geometry', geoalchemy2.Geometry(geometry_type='POLYGON', srid=4326, spatial_index=True), nullable=False),
        sa.Column('source', sa.String(30), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    # land_cover
    op.create_table(
        'land_cover',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('class_code', sa.Integer, nullable=False, index=True),
        sa.Column('class_name', sa.String(50), nullable=False, index=True),
        sa.Column('year', sa.Integer, nullable=False, index=True),
        sa.Column('state_code', sa.String(10), nullable=False, index=True),
        sa.Column('district', sa.String(40), nullable=False, index=True),
        sa.Column('geometry', geoalchemy2.Geometry(geometry_type='POLYGON', srid=4326, spatial_index=True), nullable=False),
        sa.Column('source', sa.String(30), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    # elevation_tiles
    op.create_table(
        'elevation_tiles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('min_elevation_m', sa.Numeric(8, 2), nullable=False),
        sa.Column('max_elevation_m', sa.Numeric(8, 2), nullable=False),
        sa.Column('mean_elevation_m', sa.Numeric(8, 2), nullable=False),
        sa.Column('mean_slope_deg', sa.Numeric(5, 2), nullable=False),
        sa.Column('max_slope_deg', sa.Numeric(5, 2), nullable=False),
        sa.Column('slope_histogram', JSON, nullable=True),
        sa.Column('state_code', sa.String(10), nullable=False, index=True),
        sa.Column('district', sa.String(40), nullable=False, index=True),
        sa.Column('geometry', geoalchemy2.Geometry(geometry_type='POLYGON', srid=4326, spatial_index=True), nullable=False),
        sa.Column('source', sa.String(30), nullable=False),
        sa.Column('ee_asset_id', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
    )

    # parcel_terrain_profiles
    op.create_table(
        'parcel_terrain_profiles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('parcel_id', UUID(as_uuid=True), sa.ForeignKey('parcels.id', ondelete='CASCADE'), unique=True, index=True, nullable=False),

        # Elevation
        sa.Column('mean_elevation_m', sa.Numeric(8, 2), nullable=False),
        sa.Column('min_elevation_m', sa.Numeric(8, 2), nullable=False),
        sa.Column('max_elevation_m', sa.Numeric(8, 2), nullable=False),
        sa.Column('elevation_range_m', sa.Numeric(8, 2), nullable=False),

        # Slope
        sa.Column('mean_slope_deg', sa.Numeric(5, 2), nullable=False),
        sa.Column('max_slope_deg', sa.Numeric(5, 2), nullable=False),
        sa.Column('steep_slope_percentage', sa.Numeric(5, 2), nullable=False),

        # Land cover
        sa.Column('dominant_land_cover', sa.String(50), nullable=False),
        sa.Column('land_cover_mix', JSON, nullable=False),

        # Infrastructure proximity
        sa.Column('nearest_road_distance_m', sa.Numeric(10, 2), nullable=False),
        sa.Column('nearest_road_type', sa.String(30), nullable=True),
        sa.Column('road_access_score', sa.Numeric(3, 2), nullable=False),

        # Buildings
        sa.Column('building_count', sa.Integer, default=0, nullable=False),
        sa.Column('building_coverage_percentage', sa.Numeric(5, 2), nullable=False),
        sa.Column('building_density_per_ha', sa.Numeric(6, 2), nullable=False),

        # Risk/Constraints
        sa.Column('flood_risk_score', sa.Numeric(3, 2), nullable=False),
        sa.Column('constraints', JSON, nullable=False),

        # Metadata
        sa.Column('computed_at', sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column('sources', JSON, nullable=False),
    )


def downgrade() -> None:
    op.drop_table('parcel_terrain_profiles')
    op.drop_table('elevation_tiles')
    op.drop_table('land_cover')
    op.drop_table('building_footprints')
    op.drop_table('road_networks')