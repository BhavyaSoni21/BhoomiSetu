"""add_onboarding_completed

Revision ID: c1e2f3a40003
Revises: b1d2e3f40002
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'c1e2f3a40003'
down_revision: Union[str, None] = 'b1d2e3f40002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # New accounts default to False (they get onboarding); the column is added
    # with server_default='false' so the NOT NULL backfill succeeds.
    op.add_column(
        'users',
        sa.Column('onboarding_completed', sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    # Every row that exists at migration time is a pre-existing account - mark
    # them completed so a deploy never forces existing users through onboarding
    # (spec §12). Future INSERTs still get the False server_default.
    op.execute("UPDATE users SET onboarding_completed = true")


def downgrade() -> None:
    op.drop_column('users', 'onboarding_completed')
