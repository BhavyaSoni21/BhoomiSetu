"""add verification_evidence table and workflows.assigned_verifier_id

Revision ID: 7c30732a9782
Revises: 419b9411df32
Create Date: 2026-09-16 02:20:00.000000

BACKLOG.md item #19: Verifier role + GPS/photo/evidence capture.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = '7c30732a9782'
down_revision: Union[str, None] = '419b9411df32'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('workflows', sa.Column('assigned_verifier_id', sa.String(), nullable=True))

    op.create_table('verification_evidence',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('workflow_id', sa.UUID(), nullable=False),
    sa.Column('verifier_id', sa.String(), nullable=False),
    sa.Column('photo_file_name', sa.String(), nullable=False),
    sa.Column('photo_file_path', sa.String(), nullable=False),
    sa.Column('mime_type', sa.String(length=40), nullable=False),
    sa.Column('latitude', sa.Float(), nullable=False),
    sa.Column('longitude', sa.Float(), nullable=False),
    sa.Column('captured_at', sa.DateTime(), nullable=False),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_verification_evidence_workflow_id', 'verification_evidence', ['workflow_id'])


def downgrade() -> None:
    op.drop_index('ix_verification_evidence_workflow_id', table_name='verification_evidence')
    op.drop_table('verification_evidence')
    op.drop_column('workflows', 'assigned_verifier_id')
