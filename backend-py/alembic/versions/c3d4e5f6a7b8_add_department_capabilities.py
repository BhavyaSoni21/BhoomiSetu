"""add capabilities column to departments (§20, §60)

Revision ID: c3d4e5f6a7b8
Revises: e1f2a3b4c5d6
Create Date: 2026-09-20 19:55:00.000000

Phase 3.2: Department capabilities — adds a JSON column for the
capability matrix that the capability-check service uses (§20, §63).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Capability matrix (§20, §60): list of capability strings this department possesses.
    # e.g. ["VIEW_PARCEL", "PARCEL_360", "ASSIGN_VERIFIER", "EDIT_TAX_DATA", ...]
    op.add_column('departments', sa.Column('capabilities', JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('departments', 'capabilities')
