"""add is_finished to competition

Revision ID: 7bbe7cb54b47
Revises: 1e123c1112b5
Create Date: 2026-08-25 21:10:21.320718

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7bbe7cb54b47"
down_revision: str | None = "1e123c1112b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Not batch_alter_table: SQLite adds a column in place, while batch mode
    # would rebuild the table for no reason. See migrations/env.py.
    #
    # Existing competitions are open, hence the server default. It stays on the
    # column so a plain INSERT that predates the model still works.
    op.add_column(
        "competition",
        sa.Column(
            "is_finished", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )


def downgrade() -> None:
    op.drop_column("competition", "is_finished")
