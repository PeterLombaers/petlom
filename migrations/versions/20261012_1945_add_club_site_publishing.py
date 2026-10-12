"""add club site publishing

Revision ID: a72852daca0d
Revises: 4ed65084e238
Create Date: 2026-10-12 19:45:28.413710

"""

from collections.abc import Sequence

import sqlalchemy as sa

# Imported even when unused: autogenerate renders string columns as
# sqlmodel.sql.sqltypes.AutoString.
import sqlmodel
from alembic import op

revision: str = "a72852daca0d"
down_revision: str | None = "4ed65084e238"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "clubsitepost",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("competition_id", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("post_id", sa.Integer(), nullable=False),
        sa.Column("url", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("with_results", sa.Boolean(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["competition_id"], ["competition.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("competition_id", "round"),
    )
    # Not batch_alter_table: SQLite adds a column in place, while batch mode
    # would rebuild the table for no reason. See migrations/env.py. The server
    # default gives every existing competition an empty category list.
    op.add_column(
        "competition",
        sa.Column(
            "club_site_category_ids", sa.JSON(), server_default="[]", nullable=False
        ),
    )


def downgrade() -> None:
    with op.batch_alter_table("competition", schema=None) as batch_op:
        batch_op.drop_column("club_site_category_ids")
    op.drop_table("clubsitepost")
