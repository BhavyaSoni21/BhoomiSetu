"""add_gist_spatial_indexes

Revision ID: 15753b4d91a3
Revises: 42f18021a817
Create Date: 2026-09-18 02:06:40.752262

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# geoalchemy2 isn't auto-imported by Alembic's autogenerate even when a
# migration references geoalchemy2.types.Geometry (a known limitation) -
# imported unconditionally here so every migration touching a geometry
# column works without a manual fixup.
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = '15753b4d91a3'
down_revision: Union[str, None] = '42f18021a817'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # GIST spatial indexes for geometry columns
    op.create_index('parcels_geom_gist', 'parcels', ['geometry'], postgresql_using='gist')
    op.create_index('restriction_zones_geom_gist', 'restriction_zones', ['geometry'], postgresql_using='gist')
    op.create_index('zoning_overlays_geom_gist', 'zoning_overlays', ['geometry'], postgresql_using='gist')
    op.create_index('infrastructure_features_geom_gist', 'infrastructure_features', ['geometry'], postgresql_using='gist')
    op.create_index('change_detection_events_geom_gist', 'change_detection_events', ['geometry'], postgresql_using='gist')
    op.create_index('admin_map_notes_geom_gist', 'admin_map_notes', ['geometry'], postgresql_using='gist')


def downgrade() -> None:
    op.drop_index('parcels_geom_gist', table_name='parcels', postgresql_using='gist')
    op.drop_index('restriction_zones_geom_gist', table_name='restriction_zones', postgresql_using='gist')
    op.drop_index('zoning_overlays_geom_gist', table_name='zoning_overlays', postgresql_using='gist')
    op.drop_index('infrastructure_features_geom_gist', table_name='infrastructure_features', postgresql_using='gist')
    op.drop_index('change_detection_events_geom_gist', table_name='change_detection_events', postgresql_using='gist')
    op.drop_index('admin_map_notes_geom_gist', table_name='admin_map_notes', postgresql_using='gist')
