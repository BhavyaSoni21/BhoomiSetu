"""add_evidence_authenticity_to_workflow

Revision ID: cf198ae4abaa
Revises: 7c30732a9782
Create Date: 2026-09-16 03:51:08.336924

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
# geoalchemy2 isn't auto-imported by Alembic's autogenerate even when a
# migration references geoalchemy2.types.Geometry (a known limitation) -
# imported unconditionally here so every migration touching a geometry
# column works without a manual fixup.
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = 'cf198ae4abaa'
down_revision: Union[str, None] = '7c30732a9782'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Autogenerate also detected a pre-existing, unrelated drift (a missing
    # 'idx_parcels_geometry' index vs. the model metadata) - deliberately
    # left out of this migration, which stays scoped to the authenticity
    # columns below.
    op.add_column('workflows', sa.Column('evidence_authenticity_suspicious', sa.Boolean(), nullable=True))
    op.add_column('workflows', sa.Column('evidence_authenticity_reasons', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('workflows', 'evidence_authenticity_reasons')
    op.drop_column('workflows', 'evidence_authenticity_suspicious')
