"""extend audit_logs with case-linked fields (§58)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-20 20:02:00.000000

Phase 7.3: Database Mutation Audit Trail — adds case_id, task_id,
decision_id, previous_value, new_value, reason columns to audit_logs
so every authorized DB change is traceable to its originating case/task.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Case-linked audit trail columns (§58)
    op.add_column('audit_logs', sa.Column('case_id', sa.String(), nullable=True, index=True))
    op.add_column('audit_logs', sa.Column('task_id', sa.String(), nullable=True, index=True))
    op.add_column('audit_logs', sa.Column('decision_id', sa.String(), nullable=True, index=True))
    # Value change tracking (§58)
    op.add_column('audit_logs', sa.Column('previous_value', sa.Text(), nullable=True))
    op.add_column('audit_logs', sa.Column('new_value', sa.Text(), nullable=True))
    # Reason for the change (§58)
    op.add_column('audit_logs', sa.Column('reason', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('audit_logs', 'reason')
    op.drop_column('audit_logs', 'new_value')
    op.drop_column('audit_logs', 'previous_value')
    op.drop_column('audit_logs', 'decision_id')
    op.drop_column('audit_logs', 'task_id')
    op.drop_column('audit_logs', 'case_id')
