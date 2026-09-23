"""add_legal_status_severity_to_parcels

Revision ID: a8b9c0d1e2f3
Revises: 6bd7d308d74c
Create Date: 2026-09-23 14:00:00.000000

Adds a precomputed `legal_status_severity` column to the parcels table for the
Legal Status map layer (NEW_MAP_LAYERS_PLAN.md Layer 1).

Severity scale:
  0 = clear (no active dispute or encumbrance)
  1 = encumbered only (active mortgage/lien/charge, no discharge date)
  2 = disputed – low severity (BOUNDARY or INHERITANCE dispute)
  3 = disputed – high severity (OWNERSHIP or ENCROACHMENT dispute)

Computation is handled by the `recompute_legal_status_severity` Celery task
(app/tasks/legal_status_tasks.py). This migration only adds the column; the
nightly sweep task populates existing rows after first deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# geoalchemy2 isn't auto-imported by Alembic's autogenerate even when a
# migration references geoalchemy2.types.Geometry (a known limitation) -
# imported unconditionally here so every migration touching a geometry
# column works without a manual fixup.
import geoalchemy2  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'a8b9c0d1e2f3'
down_revision: Union[str, None] = '6bd7d308d74c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'parcels',
        sa.Column(
            'legal_status_severity',
            sa.SmallInteger(),
            nullable=False,
            server_default='0',
        ),
    )
    op.create_index(
        'parcels_legal_status_idx',
        'parcels',
        ['legal_status_severity'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('parcels_legal_status_idx', table_name='parcels')
    op.drop_column('parcels', 'legal_status_severity')
