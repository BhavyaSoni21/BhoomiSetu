"""add encumbrance_certificates and survey_documents (BACKLOG #12a, #12b)

Revision ID: a1c2e3f40001
Revises: 6bd7d308d74c
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c2e3f40001'
down_revision: Union[str, None] = '6bd7d308d74c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('encumbrance_certificates',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('parcel_id', sa.String(), nullable=False),
    sa.Column('certificate_number', sa.String(length=40), nullable=False),
    sa.Column('period_from', sa.Date(), nullable=True),
    sa.Column('period_to', sa.Date(), nullable=True),
    sa.Column('has_encumbrance', sa.Boolean(), nullable=False),
    sa.Column('encumbrances_snapshot', sa.JSON(), nullable=True),
    sa.Column('storage_key', sa.String(length=200), nullable=False),
    sa.Column('issued_by', sa.String(length=100), nullable=True),
    sa.Column('issued_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('certificate_number')
    )
    op.create_index(op.f('ix_encumbrance_certificates_parcel_id'), 'encumbrance_certificates', ['parcel_id'], unique=False)

    op.create_table('survey_documents',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('parcel_id', sa.String(), nullable=False),
    sa.Column('survey_id', sa.String(), nullable=True),
    sa.Column('document_type', sa.String(length=40), nullable=False),
    sa.Column('file_name', sa.String(length=200), nullable=False),
    sa.Column('content_type', sa.String(length=100), nullable=True),
    sa.Column('storage_key', sa.String(length=200), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('gps_lat', sa.Float(), nullable=True),
    sa.Column('gps_lng', sa.Float(), nullable=True),
    sa.Column('verified', sa.Boolean(), nullable=False),
    sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('verified_by', sa.String(length=100), nullable=True),
    sa.Column('uploaded_by', sa.String(length=100), nullable=True),
    sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_survey_documents_parcel_id'), 'survey_documents', ['parcel_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_survey_documents_parcel_id'), table_name='survey_documents')
    op.drop_table('survey_documents')
    op.drop_index(op.f('ix_encumbrance_certificates_parcel_id'), table_name='encumbrance_certificates')
    op.drop_table('encumbrance_certificates')
