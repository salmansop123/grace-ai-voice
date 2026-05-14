"""add kb source fields

Revision ID: 20260507_0004
Revises: 20260507_0003
Create Date: 2026-05-07 16:45:00
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260507_0004"
down_revision: Union[str, None] = "20260507_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("kb_documents", sa.Column("source", sa.String(), nullable=False, server_default="manual"))
    op.add_column("kb_documents", sa.Column("source_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("kb_documents", "source_id")
    op.drop_column("kb_documents", "source")
