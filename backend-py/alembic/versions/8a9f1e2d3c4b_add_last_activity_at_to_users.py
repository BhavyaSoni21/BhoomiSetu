"""add last_activity_at to users table

Revision ID: 8a9f1e2d3c4b
Revises: 557c0fbfd423
Create Date: 2026-09-17 10:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8a9f1e2d3c4b'
down_revision = '557c0fbfd423'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('last_activity_at', sa.DateTime(), nullable=True))
    op.create_index(op.f('ix_users_last_activity_at'), 'users', ['last_activity_at'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_last_activity_at'), table_name='users')
    op.drop_column('users', 'last_activity_at')