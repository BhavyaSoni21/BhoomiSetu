"""add_dataset_status_to_processing_job

Revision ID: 9c2e1f4a7b3d
Revises: 8b3f2a1c9d4e
Create Date: 2026-09-18 04:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '9c2e1f4a7b3d'
down_revision: Union[str, None] = '8b3f2a1c9d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add per-dataset status tracking to ProcessingJob
    op.add_column('processing_jobs', sa.Column('dataset_status', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('processing_jobs', sa.Column('total_estimated_eecu', sa.Numeric(10, 3), nullable=True))
    op.add_column('processing_jobs', sa.Column('actual_eecu', sa.Numeric(10, 3), nullable=True))


def downgrade() -> None:
    op.drop_column('processing_jobs', 'actual_eecu')
    op.drop_column('processing_jobs', 'total_estimated_eecu')
    op.drop_column('processing_jobs', 'dataset_status')