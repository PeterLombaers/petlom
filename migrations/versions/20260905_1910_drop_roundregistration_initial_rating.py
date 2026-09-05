"""drop roundregistration.initial_rating

Revision ID: 3f1781998f14
Revises: 9b9422212a7c
Create Date: 2026-09-05 19:10:05.432455

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3f1781998f14"
down_revision: str | None = "9b9422212a7c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("roundregistration", schema=None) as batch_op:
        batch_op.drop_column("initial_rating")


def downgrade() -> None:
    with op.batch_alter_table("roundregistration", schema=None) as batch_op:
        batch_op.add_column(sa.Column("initial_rating", sa.FLOAT(), nullable=True))
