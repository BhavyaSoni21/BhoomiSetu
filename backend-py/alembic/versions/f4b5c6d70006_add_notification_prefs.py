"""add_notification_channel_prefs

Revision ID: f4b5c6d70006
Revises: e3a4b5c60005
Create Date: 2026-09-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f4b5c6d70006'
down_revision: Union[str, None] = 'e3a4b5c60005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Default true so existing accounts keep receiving every channel; delivery
    # still also requires the channel's contact to be verified.
    op.add_column('users', sa.Column('notify_sms', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('users', sa.Column('notify_email', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('users', sa.Column('notify_in_app', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    op.drop_column('users', 'notify_in_app')
    op.drop_column('users', 'notify_email')
    op.drop_column('users', 'notify_sms')
