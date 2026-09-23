"""add_value_band_to_parcels

Revision ID: b1c2d3e4f5a6
Revises: a8b9c0d1e2f3
Create Date: 2026-09-23 15:30:00.000000

Adds a precomputed `value_band` column to the parcels table for the
Circle Rate / Guidance Value Heatmap layer (NEW_MAP_LAYERS_PLAN.md Layer 3).

Band scale (based on market_value_reference / area_sq_m, i.e. ₹/sqm):
  0 = no data (parcel has no tax record with market_value_reference)
  1 = < ₹500/sqm      (very low)
  2 = ₹500–1 199/sqm  (low)
  3 = ₹1 200–1 999/sqm (medium)
  4 = ₹2 000–2 999/sqm (high)
  5 = ≥ ₹3 000/sqm     (very high)

Computation is handled by the `recompute_value_band` Celery task
(app/tasks/value_band_tasks.py). This migration only adds the column;
the seed_value_band.py script (or the nightly sweep task) populates
existing rows after first deploy.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a8b9c0d1e2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'parcels',
        sa.Column(
            'value_band',
            sa.SmallInteger(),
            nullable=False,
            server_default='0',
        ),
    )
    op.create_index(
        'parcels_value_band_idx',
        'parcels',
        ['value_band'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('parcels_value_band_idx', table_name='parcels')
    op.drop_column('parcels', 'value_band')
