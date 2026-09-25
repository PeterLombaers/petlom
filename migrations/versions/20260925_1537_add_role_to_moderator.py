"""add role to moderator

Revision ID: 4ed65084e238
Revises: 3f1781998f14
Create Date: 2026-09-25 15:37:33.781862

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "4ed65084e238"
down_revision: str | None = "3f1781998f14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Not batch_alter_table: SQLite adds a column in place, while batch mode
    # would rebuild the table for no reason. See migrations/env.py.
    #
    # sa.Enum stores the member *name*, so the default is "MODERATOR" rather
    # than "moderator". Every account that predates this column is a full
    # moderator, hence the server default. It stays on the column so a plain
    # INSERT that predates the model still works.
    op.add_column(
        "moderator",
        sa.Column(
            "role",
            sa.Enum("MODERATOR", "RESULT_KEEPER", name="role"),
            nullable=False,
            server_default="MODERATOR",
        ),
    )


def downgrade() -> None:
    op.drop_column("moderator", "role")
