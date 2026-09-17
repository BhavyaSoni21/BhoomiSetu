"""add governance rule configuration

Revision ID: 9f2a8b1c3d4e
Revises: ba6302b0a394
Create Date: 2026-09-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9f2a8b1c3d4e'
down_revision: Union[str, None] = 'ba6302b0a394'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'governance_rules',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('alert_type', sa.String(length=40), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('condition_config', sa.Text(), nullable=False),
        sa.Column('default_severity', sa.String(length=20), nullable=False, server_default='MEDIUM'),
        sa.Column('explanation_template', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('department', sa.String(length=40), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_governance_rules_alert_type'), 'governance_rules', ['alert_type'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_governance_rules_alert_type'), table_name='governance_rules')
    op.drop_table('governance_rules')