"""make competition rating nullable

Revision ID: 368453cc16c1
Revises: 7bbe7cb54b47
Create Date: 2026-09-05 17:28:32.814766

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "368453cc16c1"
down_revision: str | None = "7bbe7cb54b47"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("competitionrating", schema=None) as batch_op:
        batch_op.alter_column("initial_rating", existing_type=sa.FLOAT(), nullable=True)
        batch_op.alter_column("current_rating", existing_type=sa.FLOAT(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("competitionrating", schema=None) as batch_op:
        batch_op.alter_column(
            "current_rating", existing_type=sa.FLOAT(), nullable=False
        )
        batch_op.alter_column(
            "initial_rating", existing_type=sa.FLOAT(), nullable=False
        )
