"""add parcel address fields and pg_trgm index

Revision ID: a123456789ab
Revises: a50377247f33
Create Date: 2026-09-19 16:11:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a123456789ab'
down_revision = 'a50377247f33'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add pg_trgm extension if not exists (requires superuser, handle gracefully)
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm;')

    # Add columns
    op.add_column('parcels', sa.Column('street_address', sa.String(length=200), nullable=True))
    op.add_column('parcels', sa.Column('locality', sa.String(length=100), nullable=True))
    op.add_column('parcels', sa.Column('landmark', sa.String(length=100), nullable=True))
    op.add_column('parcels', sa.Column('pincode', sa.String(length=20), nullable=True))

    # Add GIN index for fuzzy search across all address fields
    # Use CONCURRENTLY to avoid blocking writes (requires PostgreSQL 12+)
    # CONCURRENTLY cannot run inside a transaction, so use autocommit
    op.execute(
        '''
        CREATE INDEX CONCURRENTLY ix_parcels_address_trgm ON parcels USING gin (
            (
                coalesce(street_address, '') || ' ' || 
                coalesce(locality, '') || ' ' || 
                coalesce(landmark, '') || ' ' || 
                coalesce(pincode, '')
            ) gin_trgm_ops
        );
        ''',
        execution_options={"autocommit": True}
    )


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ix_parcels_address_trgm;')
    op.drop_column('parcels', 'pincode')
    op.drop_column('parcels', 'landmark')
    op.drop_column('parcels', 'locality')
    op.drop_column('parcels', 'street_address')
