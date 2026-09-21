"""add case management tables and parcel current_state

Revision ID: e1f2a3b4c5d6
Revises: 57b9e6f93f68
Create Date: 2026-09-20 15:30:00.000000

Phase 1 Foundation: Case engine, AI analysis, routing, SLA,
appointments, timeline, feedback, geometry versioning, parcel state snapshot.

Phase 2: Case applications (§14, §16) — application versioning and
document generation artifacts.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2
from sqlalchemy.dialects.postgresql import JSON, UUID


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = '57b9e6f93f68'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Parcel current_state (§41) ---
    op.add_column('parcels', sa.Column('current_state', JSON(), nullable=True))

    # --- SLA Configs (§56) ---
    op.create_table(
        'sla_configs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('workflow_id', UUID(as_uuid=True), nullable=True),
        sa.Column('task_id', UUID(as_uuid=True), nullable=True),
        sa.Column('department_id', UUID(as_uuid=True), nullable=True),
        sa.Column('threshold_hours', sa.Numeric(5, 2), nullable=False),
        sa.Column('warning_threshold', sa.Numeric(5, 2), nullable=False),
        sa.Column('breach_threshold', sa.Numeric(5, 2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
    )

    # --- Cases (§6, §59) ---
    op.create_table(
        'cases',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('case_no', sa.String(30), nullable=False, unique=True, index=True),
        sa.Column('citizen_id', sa.String(), nullable=False, index=True),
        sa.Column('parcel_id', sa.String(), nullable=False, index=True),
        sa.Column('intent', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='CREATED'),
        sa.Column('priority', sa.String(20), nullable=True),
        sa.Column('routing_decision', JSON(), nullable=True),
        sa.Column('sla_config_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['sla_config_id'], ['sla_configs.id'], ondelete='SET NULL'),
    )

    # --- Department Tasks (§18, §59) ---
    op.create_table(
        'department_tasks',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('department_id', UUID(as_uuid=True), nullable=False),
        sa.Column('workflow_id', UUID(as_uuid=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='PENDING'),
        sa.Column('assigned_officer_id', sa.String(), nullable=True),
        sa.Column('stage', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('stage_name', sa.String(100), nullable=True),
        sa.Column('resolution_mode', sa.String(30), nullable=True),
        sa.Column('resolution_decision', sa.String(20), nullable=True),
        sa.Column('resolution_remarks', sa.Text(), nullable=True),
        sa.Column('sla_threshold_hours', sa.Numeric(5, 2), nullable=True),
        sa.Column('sla_warning_threshold', sa.Numeric(5, 2), nullable=True),
        sa.Column('sla_breach_threshold', sa.Numeric(5, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ondelete='SET NULL'),
    )

    # --- AI Analyses (§11) ---
    op.create_table(
        'ai_analyses',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('structured_understanding', JSON(), nullable=True),
        sa.Column('facts_stated', JSON(), nullable=True),
        sa.Column('facts_verified', JSON(), nullable=True),
        sa.Column('departments_identified', JSON(), nullable=True),
        sa.Column('application_draft', sa.Text(), nullable=True),
        sa.Column('follow_up_questions', JSON(), nullable=True),
        sa.Column('conversation', JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
    )

    # --- Case Applications (§14, §16) — application versioning & document artifacts ---
    op.create_table(
        'case_applications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('original_input', sa.Text(), nullable=True),
        sa.Column('conversation', JSON(), nullable=True),
        sa.Column('ai_interpretation', JSON(), nullable=True),
        sa.Column('ai_draft', sa.Text(), nullable=True),
        sa.Column('citizen_edited_version', sa.Text(), nullable=True),
        sa.Column('final_submitted_version', sa.Text(), nullable=True),
        sa.Column('generated_document_path', sa.String(500), nullable=True),
        sa.Column('generated_at', sa.DateTime(), nullable=True),
        sa.Column('citizen_confirmed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('citizen_confirmation_timestamp', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
    )

    # --- Routing Decisions (§17) ---
    op.create_table(
        'routing_decisions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('departments_routed', JSON(), nullable=True),
        sa.Column('workflow_per_department', JSON(), nullable=True),
        sa.Column('priority', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
    )

    # --- Appointments (§45, §46) ---
    op.create_table(
        'appointments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('citizen_id', sa.String(), nullable=False),
        sa.Column('department_id', UUID(as_uuid=True), nullable=False),
        sa.Column('officer_id', sa.String(), nullable=True),
        sa.Column('office_location', sa.String(200), nullable=True),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('time_slot', sa.String(20), nullable=True),
        sa.Column('purpose', sa.String(500), nullable=True),
        sa.Column('required_documents', JSON(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='REQUESTED'),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE'),
    )

    # --- Case Timeline Events (§57) ---
    op.create_table(
        'case_timeline_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('task_id', UUID(as_uuid=True), nullable=True),
        sa.Column('event_type', sa.String(50), nullable=False, index=True),
        sa.Column('actor_id', sa.String(), nullable=True),
        sa.Column('actor_role', sa.String(30), nullable=True),
        sa.Column('previous_state', sa.String(100), nullable=True),
        sa.Column('new_state', sa.String(100), nullable=True),
        sa.Column('metadata', JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
    )

    # --- Feedback (§51, §52, Invariant 11) ---
    op.create_table(
        'feedback',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('citizen_id', sa.String(), nullable=False),
        sa.Column('officer_id', sa.String(), nullable=True),
        sa.Column('department_id', UUID(as_uuid=True), nullable=True),
        sa.Column('task_id', UUID(as_uuid=True), nullable=True),
        sa.Column('category', sa.String(40), nullable=True),
        sa.Column('officer_rating', sa.Numeric(1, 0), nullable=True),
        sa.Column('overall_case_rating', sa.Numeric(1, 0), nullable=True),
        sa.Column('type', sa.String(30), nullable=True),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('reasons', JSON(), nullable=True),
        sa.Column('is_anonymous', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['case_id'], ['cases.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='SET NULL'),
    )

    # --- Case Parcel Geometry Versions (§43) ---
    op.create_table(
        'case_parcel_geometry_versions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('case_id', UUID(as_uuid=True), nullable=False, index=True),
        sa.Column('parcel_id', sa.String(), nullable=False, index=True),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('geometry', geoalchemy2.types.Geometry(geometry_type='POLYGON', srid=4326, spatial_index=False), nullable=False),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_proposed', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('change_reason', sa.String(500), nullable=True),
        sa.Column('changed_by', sa.String(), nullable=True),
        sa.Column('decision_id', UUID(as_uuid=True), nullable=True),
        sa.Column('verification_id', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('case_id', 'parcel_id', 'version_number', name='uq_case_parcel_version'),
    )


def downgrade() -> None:
    op.drop_table('case_parcel_geometry_versions')
    op.drop_table('feedback')
    op.drop_table('case_timeline_events')
    op.drop_table('appointments')
    op.drop_table('sla_configs')
    op.drop_table('routing_decisions')
    op.drop_table('case_applications')
    op.drop_table('ai_analyses')
    op.drop_table('department_tasks')
    op.drop_table('cases')
    op.drop_column('parcels', 'current_state')
