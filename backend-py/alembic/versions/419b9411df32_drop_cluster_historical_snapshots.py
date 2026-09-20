"""drop cluster_historical_snapshots

Revision ID: 419b9411df32
Revises: ba6302b0a394
Create Date: 2026-09-16 00:00:00.000000

Satellite/historical imagery now comes live from Google Earth Engine
instead of a seed-time-rendered PNG per cluster/year - see
docs/architecture/BACKLOG.md item 10.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = '419b9411df32'
down_revision: Union[str, None] = 'ba6302b0a394'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL for idempotent drop operations
    # In offline mode, op.get_bind() returns a MockConnection without commit()
    conn = op.get_bind()
    
    # Drop index if exists
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_cluster_historical_snapshots_cluster_year"))
    
    # Drop table if exists
    conn.execute(sa.text("DROP TABLE IF EXISTS cluster_historical_snapshots"))
    
    # Commit only in online mode (offline mode uses MockConnection without commit)
    if hasattr(conn, 'commit'):
        conn.commit()


def downgrade() -> None:
    op.create_table('cluster_historical_snapshots',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('cluster_id', sa.String(), nullable=False),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('image_path', sa.String(), nullable=False),
    sa.Column('bounds', sa.String(), nullable=False),
    sa.Column('generated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_cluster_historical_snapshots_cluster_year', 'cluster_historical_snapshots', ['cluster_id', 'year'], unique=True)
