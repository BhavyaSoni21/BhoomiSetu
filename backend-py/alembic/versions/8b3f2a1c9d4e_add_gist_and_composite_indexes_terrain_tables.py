"""add_gist_and_composite_indexes_terrain_tables

Revision ID: 8b3f2a1c9d4e
Revises: 57b9e6f93f68
Create Date: 2026-09-18 04:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2

# revision identifiers, used by Alembic.
revision: str = '8b3f2a1c9d4e'
down_revision: Union[str, None] = '57b9e6f93f68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # GIST spatial indexes for terrain tables
    op.create_index('road_networks_geometry_gist', 'road_networks', ['geometry'], postgresql_using='gist')
    op.create_index('building_footprints_geometry_gist', 'building_footprints', ['geometry'], postgresql_using='gist')
    op.create_index('land_cover_geometry_gist', 'land_cover', ['geometry'], postgresql_using='gist')
    op.create_index('elevation_tiles_geometry_gist', 'elevation_tiles', ['geometry'], postgresql_using='gist')
    op.create_index('parcel_terrain_profiles_parcel_id_idx', 'parcel_terrain_profiles', ['parcel_id'], unique=True)
    
    # Composite indexes for district-scoped queries
    op.create_index('road_networks_state_district_idx', 'road_networks', ['state_code', 'district'])
    op.create_index('building_footprints_state_district_idx', 'building_footprints', ['state_code', 'district'])
    op.create_index('land_cover_state_district_year_idx', 'land_cover', ['state_code', 'district', 'year'])
    op.create_index('elevation_tiles_state_district_idx', 'elevation_tiles', ['state_code', 'district'])
    
    # Additional indexes for common query patterns
    op.create_index('land_cover_class_code_idx', 'land_cover', ['class_code'])
    op.create_index('building_footprints_confidence_idx', 'building_footprints', ['confidence'])
    op.create_index('road_networks_road_type_idx', 'road_networks', ['road_type'])


def downgrade() -> None:
    op.drop_index('road_networks_road_type_idx', table_name='road_networks')
    op.drop_index('building_footprints_confidence_idx', table_name='building_footprints')
    op.drop_index('land_cover_class_code_idx', table_name='land_cover')
    op.drop_index('elevation_tiles_state_district_idx', table_name='elevation_tiles')
    op.drop_index('land_cover_state_district_year_idx', table_name='land_cover')
    op.drop_index('building_footprints_state_district_idx', table_name='building_footprints')
    op.drop_index('road_networks_state_district_idx', table_name='road_networks')
    op.drop_index('parcel_terrain_profiles_parcel_id_idx', table_name='parcel_terrain_profiles')
    op.drop_index('elevation_tiles_geometry_gist', table_name='elevation_tiles', postgresql_using='gist')
    op.drop_index('land_cover_geometry_gist', table_name='land_cover', postgresql_using='gist')
    op.drop_index('building_footprints_geometry_gist', table_name='building_footprints', postgresql_using='gist')
    op.drop_index('road_networks_geometry_gist', table_name='road_networks', postgresql_using='gist')