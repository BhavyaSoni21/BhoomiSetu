"""merge heads: Auth branch + main branch

Revision ID: a50377247f33
Revises: 17d915971de6, 4bc2bd5e393d
Create Date: 2026-09-19 01:39:26.214945

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
revision: str = 'a50377247f33'
down_revision: Union[str, None] = ('17d915971de6', '4bc2bd5e393d')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
