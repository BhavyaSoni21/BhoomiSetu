"""add_verifier_availability_assigned_area

Revision ID: e3a4b5c60005
Revises: d2f3a4b50004
Create Date: 2026-09-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3a4b5c60005'
down_revision: Union[str, None] = 'd2f3a4b50004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable - real verifier metadata an admin sets; unset stays NULL and the
    # officer picker shows "unknown" rather than a fabricated value. No backfill.
    op.add_column('users', sa.Column('availability', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('assigned_area', sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'assigned_area')
    op.drop_column('users', 'availability')
