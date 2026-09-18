"""add_profile_fields_config

Revision ID: e0a0a34362ae
Revises: 15753b4d91a3
Create Date: 2026-09-18 02:11:32.833354

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
revision: str = 'e0a0a34362ae'
down_revision: Union[str, None] = '15753b4d91a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Profile fields configuration table - allows dynamic profile fields
    op.create_table('profile_fields',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('field_name', sa.String(50), nullable=False),
        sa.Column('field_label', sa.String(100), nullable=False),
        sa.Column('field_type', sa.String(20), nullable=False),  # text, email, mobile, select, date, etc.
        sa.Column('field_options', postgresql.JSONB(), nullable=True),  # for select fields: options list
        sa.Column('is_required', sa.Boolean(), nullable=False, default=False),
        sa.Column('is_editable', sa.Boolean(), nullable=False, default=True),
        sa.Column('display_order', sa.Integer(), nullable=False, default=0),
        sa.Column('roles', postgresql.JSONB(), nullable=True),  # which roles this field applies to
        sa.Column('validation_regex', sa.String(200), nullable=True),
        sa.Column('help_text', sa.String(300), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('field_name')
    )
    op.create_index('ix_profile_fields_is_active', 'profile_fields', ['is_active'])
    op.create_index('ix_profile_fields_display_order', 'profile_fields', ['display_order'])

    # Seed with current profile fields
    op.execute("""
        INSERT INTO profile_fields (id, field_name, field_label, field_type, is_required, is_editable, display_order, roles, validation_regex, help_text, is_active) VALUES
        (gen_random_uuid(), 'name', 'Full Name', 'text', true, true, 1, '["CITIZEN", "LAND_RECORD_OFFICER", "REGISTRATION_OFFICER", "PLANNING_OFFICER", "DISPUTE_OFFICER", "TAX_OFFICER", "RESTRICTION_OFFICER", "ENCUMBRANCE_OFFICER", "ADMIN"]', NULL, 'Your full legal name', true),
        (gen_random_uuid(), 'address', 'Address', 'text', false, true, 2, '["CITIZEN", "LAND_RECORD_OFFICER", "REGISTRATION_OFFICER", "PLANNING_OFFICER", "DISPUTE_OFFICER", "TAX_OFFICER", "RESTRICTION_OFFICER", "ENCUMBRANCE_OFFICER", "ADMIN"]', NULL, 'Your residential address', true),
        (gen_random_uuid(), 'government_id_number', 'Government ID Number', 'text', false, true, 3, '["CITIZEN"]', '^[A-Z0-9]{10,20}$', 'Aadhaar, PAN, or other government ID', true),
        (gen_random_uuid(), 'occupation', 'Occupation', 'text', false, true, 4, '["CITIZEN"]', NULL, 'Your current occupation', true),
        (gen_random_uuid(), 'district', 'District', 'text', false, true, 5, '["LAND_RECORD_OFFICER", "REGISTRATION_OFFICER", "PLANNING_OFFICER", "DISPUTE_OFFICER", "TAX_OFFICER", "RESTRICTION_OFFICER", "ENCUMBRANCE_OFFICER", "ADMIN"]', NULL, 'Assigned district for officers', true)
    """)


def downgrade() -> None:
    op.drop_index('ix_profile_fields_display_order', table_name='profile_fields')
    op.drop_index('ix_profile_fields_is_active', table_name='profile_fields')
    op.drop_table('profile_fields')
