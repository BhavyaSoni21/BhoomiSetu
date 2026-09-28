"""case active-invariant unique index + department_task FK indexes

Revision ID: a5b6c7d80007
Revises: f4b5c6d70006
Create Date: 2026-09-28 00:00:00.000000

SEC-03: enforce Invariant 1 (one active case per citizen+parcel) as a partial
unique index so the service-layer read-then-write can't be raced.
DB-01: index the department_tasks FK/assignment columns that officer/admin
task queries filter on (case_id already indexed at model level).
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import text as sa_text


# revision identifiers, used by Alembic.
revision: str = 'a5b6c7d80007'
down_revision: Union[str, None] = 'f4b5c6d70006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'uq_cases_active_citizen_parcel',
        'cases',
        ['citizen_id', 'parcel_id'],
        unique=True,
        postgresql_where=sa_text("status IN ('CREATED', 'ACTIVE', 'RESOLUTION', 'FEEDBACK')"),
    )
    op.create_index('ix_department_tasks_department_id', 'department_tasks', ['department_id'])
    op.create_index('ix_department_tasks_workflow_id', 'department_tasks', ['workflow_id'])
    op.create_index('ix_department_tasks_assigned_officer_id', 'department_tasks', ['assigned_officer_id'])
    op.create_index('ix_department_tasks_assigned_verifier_id', 'department_tasks', ['assigned_verifier_id'])


def downgrade() -> None:
    op.drop_index('ix_department_tasks_assigned_verifier_id', table_name='department_tasks')
    op.drop_index('ix_department_tasks_assigned_officer_id', table_name='department_tasks')
    op.drop_index('ix_department_tasks_workflow_id', table_name='department_tasks')
    op.drop_index('ix_department_tasks_department_id', table_name='department_tasks')
    op.drop_index('uq_cases_active_citizen_parcel', table_name='cases')
