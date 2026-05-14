from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    thread_id: Mapped[str] = mapped_column(
        String, ForeignKey("conversation_threads.id"), nullable=False
    )
    org_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id"), nullable=False)
    contact_id: Mapped[str | None] = mapped_column(String, ForeignKey("contacts.id"), nullable=True)
    channel: Mapped[str] = mapped_column(String, nullable=False)
    sender_role: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    meta: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    thread = relationship("ConversationThread", back_populates="messages")
