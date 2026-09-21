"""Merge heads

Revision ID: 874081f71312
Revises: a123456789ab, e5f6a7b8c9d0, f6a7b8c9d0e1
Create Date: 2026-09-21 21:42:10.387126

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
revision: str = '874081f71312'
down_revision: Union[str, None] = ('a123456789ab', 'e5f6a7b8c9d0', 'f6a7b8c9d0e1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
