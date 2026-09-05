"""drop stored current rating

Revision ID: 9b9422212a7c
Revises: 368453cc16c1
Create Date: 2026-09-05 18:34:20.966381

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9b9422212a7c"
down_revision: str | None = "368453cc16c1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("competitionrating", schema=None) as batch_op:
        batch_op.drop_column("current_rating")


def downgrade() -> None:
    with op.batch_alter_table("competitionrating", schema=None) as batch_op:
        batch_op.add_column(sa.Column("current_rating", sa.FLOAT(), nullable=True))
