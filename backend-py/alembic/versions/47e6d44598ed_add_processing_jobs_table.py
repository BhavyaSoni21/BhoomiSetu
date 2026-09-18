"""add_processing_jobs_table

Revision ID: 47e6d44598ed
Revises: e0a0a34362ae
Create Date: 2026-09-18 02:15:38.979558

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
# geoalchemy2 isn't auto-imported by Alembic's autogenerate even when a
# migration references geoalchemy2.types.Geometry (a known limitation) -
# imported unconditionally here so every migration touching a geometry
# column works without a manual fixup.
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = '47e6d44598ed'
down_revision: Union[str, None] = 'e0a0a34362ae'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Processing jobs table for background tasks (Celery)
    op.create_table('processing_jobs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('job_type', sa.String(50), nullable=False),  # 'earth_engine', 'ocr', 'etl', 'change_detection'
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='queued'),  # queued, running, succeeded, failed
        sa.Column('result', postgresql.JSONB(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('idempotency_key', sa.String(100), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_processing_jobs_status', 'processing_jobs', ['status'])
    op.create_index('ix_processing_jobs_idempotency', 'processing_jobs', ['idempotency_key'], unique=True)
    op.create_index('ix_processing_jobs_job_type', 'processing_jobs', ['job_type'])


def downgrade() -> None:
    op.drop_index('ix_processing_jobs_job_type', table_name='processing_jobs')
    op.drop_index('ix_processing_jobs_idempotency', table_name='processing_jobs')
    op.drop_index('ix_processing_jobs_status', table_name='processing_jobs')
    op.drop_table('processing_jobs')
