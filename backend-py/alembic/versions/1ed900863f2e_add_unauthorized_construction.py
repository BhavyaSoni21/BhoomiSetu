"""add_unauthorized_construction

Revision ID: 1ed900863f2e
Revises: 6d9a779ec0e2
Create Date: 2026-09-23 19:31:14.976038

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
revision: str = '1ed900863f2e'
down_revision: Union[str, None] = '6d9a779ec0e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('parcels', sa.Column('unauthorized_construction_suspected', sa.Boolean(), server_default='false'))
    op.add_column('change_detection_events', sa.Column('cross_checked_against_permission', sa.Boolean(), server_default='false'))


def downgrade() -> None:
    op.drop_column('change_detection_events', 'cross_checked_against_permission')
    op.drop_column('parcels', 'unauthorized_construction_suspected')
