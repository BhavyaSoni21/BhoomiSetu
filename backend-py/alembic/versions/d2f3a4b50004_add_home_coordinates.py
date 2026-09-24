"""add_home_coordinates

Revision ID: d2f3a4b50004
Revises: c1e2f3a40003
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd2f3a4b50004'
down_revision: Union[str, None] = 'c1e2f3a40003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable - captured only when a citizen grants browser geolocation during
    # onboarding; no backfill needed. Adds no data, so no reseed required.
    op.add_column('users', sa.Column('home_latitude', sa.Float(), nullable=True))
    op.add_column('users', sa.Column('home_longitude', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'home_longitude')
    op.drop_column('users', 'home_latitude')
