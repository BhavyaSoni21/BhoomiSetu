"""merge heads

Revision ID: 42f18021a817
Revises: 4c7a8b9e1d2f, 8771cd30e6b0
Create Date: 2026-09-17 18:15:51.412529

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
revision: str = '42f18021a817'
down_revision: Union[str, None] = ('4c7a8b9e1d2f', '8771cd30e6b0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
