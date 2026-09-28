"""verification_evidence client_token for idempotent offline replay (API-02)

Revision ID: b6c7d8e90008
Revises: a5b6c7d80007
Create Date: 2026-09-28 00:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b6c7d8e90008'
down_revision: Union[str, None] = 'a5b6c7d80007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('verification_evidence', sa.Column('client_token', sa.String(length=64), nullable=True))
    op.create_index(
        'uq_verification_evidence_client_token',
        'verification_evidence',
        ['client_token'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('uq_verification_evidence_client_token', table_name='verification_evidence')
    op.drop_column('verification_evidence', 'client_token')
