"""add workflow_pipeline_configs table

Revision ID: 8771cd30e6b0
Revises: 8a9f1e2d3c4b
Create Date: 2026-09-17 11:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '8771cd30e6b0'
down_revision = '8a9f1e2d3c4b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'workflow_pipeline_configs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('workflow_type', sa.String(40), unique=True, nullable=False, index=True),
        sa.Column('stages_json', sa.Text(), nullable=False, server_default='[]'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('workflow_pipeline_configs')