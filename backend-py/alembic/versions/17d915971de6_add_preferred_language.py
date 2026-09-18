"""add_preferred_language

Revision ID: 17d915971de6
Revises: 9b88c949a6ec
Create Date: 2026-09-18 23:07:18.737281

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
revision: str = '17d915971de6'
down_revision: Union[str, None] = '9b88c949a6ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('preferred_language', sa.String(length=10), server_default='hi', nullable=False))

def downgrade() -> None:
    op.drop_column('users', 'preferred_language')
