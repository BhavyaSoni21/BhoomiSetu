"""merge_terrain_heads

Revision ID: 57b9e6f93f68
Revises: a1b2c3d4e5f6, 9f2a8b1c3d4e
Create Date: 2026-09-18 03:09:29.386326

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
revision: str = '57b9e6f93f68'
down_revision: Union[str, None] = ('a1b2c3d4e5f6', '9f2a8b1c3d4e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
