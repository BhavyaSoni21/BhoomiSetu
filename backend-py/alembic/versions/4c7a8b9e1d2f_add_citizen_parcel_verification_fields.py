"""add citizen parcel verification fields

Revision ID: 4c7a8b9e1d2f
Revises: 044323afddea
Create Date: 2026-09-16 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c7a8b9e1d2f'
down_revision: Union[str, None] = 'ba6302b0a394'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('citizen_parcels', sa.Column('status', sa.String(length=30), nullable=False, server_default='Registered'))
    op.add_column('citizen_parcels', sa.Column('local_id', sa.String(length=100), nullable=True))
    op.add_column('citizen_parcels', sa.Column('verification_report', sa.Text(), nullable=True))
    op.add_column('citizen_parcels', sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False))


def downgrade() -> None:
    op.drop_column('citizen_parcels', 'created_at')
    op.drop_column('citizen_parcels', 'verification_report')
    op.drop_column('citizen_parcels', 'local_id')
    op.drop_column('citizen_parcels', 'status')
