"""add processed_sync_operations for offline-sync idempotency (spec §8)

Revision ID: b1d2e3f40002
Revises: a1c2e3f40001
Create Date: 2026-09-24 00:00:00.000000

Idempotency ledger for the offline-sync endpoint: a client-generated
operation_id is unique, so replaying a queued batch after a dropped response
returns the stored outcome instead of re-applying the mutation.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'b1d2e3f40002'
down_revision: Union[str, None] = 'a1c2e3f40001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'processed_sync_operations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('operation_id', sa.String(length=64), nullable=False),
        sa.Column('owner_user_id', sa.String(length=64), nullable=False),
        sa.Column('entity_type', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('entity_id', sa.String(length=64), nullable=True),
        sa.Column('result', postgresql.JSONB(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('client_created_at', sa.DateTime(), nullable=True),
        sa.Column('server_received_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint('uq_processed_sync_operations_operation_id', 'processed_sync_operations', ['operation_id'])
    op.create_index('ix_processed_sync_operations_owner_user_id', 'processed_sync_operations', ['owner_user_id'])


def downgrade() -> None:
    op.drop_index('ix_processed_sync_operations_owner_user_id', table_name='processed_sync_operations')
    op.drop_constraint('uq_processed_sync_operations_operation_id', 'processed_sync_operations', type_='unique')
    op.drop_table('processed_sync_operations')
