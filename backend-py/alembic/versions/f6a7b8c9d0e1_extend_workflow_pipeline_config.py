"""extend workflow_pipeline_configs with spec definition fields (§21-§23, §34, §36)

Revision ID: f6a7b8c9d0e1
Revises: d4e5f6a7b8c9
Create Date: 2026-09-20 20:05:00.000000

Phase 3.1: Workflow Configuration Model — adds template, definition_json,
resolution_modes, decision_types, conditions_json columns to support the
full Department Workflow Configuration spec (stages with types, capabilities,
SLA, conditions, resolution modes, decision types).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # §21: Template name
    op.add_column('workflow_pipeline_configs', sa.Column('template', sa.String(length=40), nullable=True))
    # §23: Full workflow definition
    op.add_column('workflow_pipeline_configs', sa.Column('definition_json', sa.Text(), nullable=True))
    # §36: Supported resolution modes
    op.add_column('workflow_pipeline_configs', sa.Column('resolution_modes', JSON(), nullable=True))
    # §34: Permitted decision types
    op.add_column('workflow_pipeline_configs', sa.Column('decision_types', JSON(), nullable=True))
    # §22: Conditional path definitions
    op.add_column('workflow_pipeline_configs', sa.Column('conditions_json', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('workflow_pipeline_configs', 'conditions_json')
    op.drop_column('workflow_pipeline_configs', 'decision_types')
    op.drop_column('workflow_pipeline_configs', 'resolution_modes')
    op.drop_column('workflow_pipeline_configs', 'definition_json')
    op.drop_column('workflow_pipeline_configs', 'template')
