"""add_risk_score_to_parcels

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-09-23 16:07:00.000000

Adds a precomputed `risk_score` column to the parcels table for the
Composite Risk Score map layer (NEW_MAP_LAYERS_PLAN.md Layer 4).

The risk score is a composite weighted heuristic (0.0 to 100.0):
  - Tax Delinquency: 0.4
  - Dispute Exposure: 0.3
  - Open Governance Alerts: 0.2
  - Standing Land-Use Restriction: 0.1

Bands:
  - LOW: < 25
  - MEDIUM: 25 - 49
  - HIGH: 50 - 74
  - CRITICAL: >= 75
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'parcels',
        sa.Column(
            'risk_score',
            sa.Numeric(5, 2),
            nullable=False,
            server_default='0',
        ),
    )
    op.create_index(
        'parcels_risk_score_idx',
        'parcels',
        ['risk_score'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index('parcels_risk_score_idx', table_name='parcels')
    op.drop_column('parcels', 'risk_score')
