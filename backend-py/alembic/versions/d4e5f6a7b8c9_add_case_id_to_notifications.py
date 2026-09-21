"""add case_id column to notifications (§50)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-20 19:58:00.000000

Phase 3.3: Notification dispatch on task state changes — adds case_id
column to notifications table so task/resolution notifications can
reference the originating case.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # case_id column (nullable — existing notifications have no case association)
    op.add_column('notifications', sa.Column('case_id', sa.String(), nullable=True, index=True))


def downgrade() -> None:
    op.drop_column('notifications', 'case_id')
