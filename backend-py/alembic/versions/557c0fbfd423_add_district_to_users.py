"""add district field to users table

Revision ID: 557c0fbfd423
Revises: cf01cbb859fb
Create Date: 2026-09-17 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '557c0fbfd423'
down_revision = 'cf01cbb859fb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('district', sa.String(length=40), nullable=True))
    op.create_index(op.f('ix_users_district'), 'users', ['district'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_district'), table_name='users')
    op.drop_column('users', 'district')