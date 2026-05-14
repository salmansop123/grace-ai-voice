"""add performance indexes

Revision ID: 20260507_0005
Revises: 20260507_0004
Create Date: 2026-05-07
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20260507_0005"
down_revision: Union[str, None] = "20260507_0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index("ix_calls_org_created_at", "calls", ["org_id", "created_at"], unique=False)
    op.create_index("ix_calls_agent_id", "calls", ["agent_id"], unique=False)
    op.create_index("ix_contacts_org_phone", "contacts", ["org_id", "phone"], unique=False)
    op.create_index(
        "ix_conversation_messages_org_created_at",
        "conversation_messages",
        ["org_id", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_conversation_messages_org_created_at", table_name="conversation_messages")
    op.drop_index("ix_contacts_org_phone", table_name="contacts")
    op.drop_index("ix_calls_agent_id", table_name="calls")
    op.drop_index("ix_calls_org_created_at", table_name="calls")
