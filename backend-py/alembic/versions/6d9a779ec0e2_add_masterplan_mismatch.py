"""add_masterplan_mismatch

Revision ID: 6d9a779ec0e2
Revises: c2d3e4f5a6b7
Create Date: 2026-09-23 17:42:04.708298

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
revision: str = '6d9a779ec0e2'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE zoning_overlays ADD COLUMN proposed_land_use VARCHAR(50);")
    op.execute("ALTER TABLE zoning_overlays ADD COLUMN proposed_effective_year SMALLINT;")
    op.execute("ALTER TABLE parcels ADD COLUMN masterplan_mismatch BOOLEAN DEFAULT FALSE;")
    op.execute("CREATE INDEX parcels_masterplan_mismatch_idx ON parcels (masterplan_mismatch);")

def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS parcels_masterplan_mismatch_idx;")
    op.execute("ALTER TABLE parcels DROP COLUMN masterplan_mismatch;")
    op.execute("ALTER TABLE zoning_overlays DROP COLUMN proposed_effective_year;")
    op.execute("ALTER TABLE zoning_overlays DROP COLUMN proposed_land_use;")
