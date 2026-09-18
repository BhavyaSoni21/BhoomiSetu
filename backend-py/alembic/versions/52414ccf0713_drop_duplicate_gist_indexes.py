"""drop_duplicate_gist_indexes

Revision ID: 52414ccf0713
Revises: 47e6d44598ed
Create Date: 2026-09-18 02:27:10.031267

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
revision: str = '52414ccf0713'
down_revision: Union[str, None] = '47e6d44598ed'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop duplicate GIST indexes created by GeoAlchemy2's spatial_index=True default
    op.drop_index('idx_parcels_geometry', table_name='parcels', postgresql_using='gist')
    op.drop_index('idx_restriction_zones_geometry', table_name='restriction_zones', postgresql_using='gist')
    op.drop_index('idx_zoning_overlays_geometry', table_name='zoning_overlays', postgresql_using='gist')
    op.drop_index('idx_infrastructure_features_geometry', table_name='infrastructure_features', postgresql_using='gist')
    op.drop_index('idx_change_detection_events_geometry', table_name='change_detection_events', postgresql_using='gist')
    op.drop_index('idx_admin_map_notes_geometry', table_name='admin_map_notes', postgresql_using='gist')


def downgrade() -> None:
    # Recreate the indexes if needed
    op.create_index('idx_parcels_geometry', 'parcels', ['geometry'], postgresql_using='gist')
    op.create_index('idx_restriction_zones_geometry', 'restriction_zones', ['geometry'], postgresql_using='gist')
    op.create_index('idx_zoning_overlays_geometry', 'zoning_overlays', ['geometry'], postgresql_using='gist')
    op.create_index('idx_infrastructure_features_geometry', 'infrastructure_features', ['geometry'], postgresql_using='gist')
    op.create_index('idx_change_detection_events_geometry', 'change_detection_events', ['geometry'], postgresql_using='gist')
    op.create_index('idx_admin_map_notes_geometry', 'admin_map_notes', ['geometry'], postgresql_using='gist')
