from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Call(Base):
    __tablename__ = "calls"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    org_id: Mapped[str] = mapped_column(String, ForeignKey("organizations.id"), nullable=False)
    agent_id: Mapped[str] = mapped_column(String, ForeignKey("agents.id"), nullable=False)
    twilio_call_sid: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    direction: Mapped[str] = mapped_column(String, nullable=False)
    from_number: Mapped[str] = mapped_column(String, nullable=False)
    to_number: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="initiated")
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transcript: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True)
    recording_url: Mapped[str | None] = mapped_column(String, nullable=True)
    sentiment: Mapped[str | None] = mapped_column(String, nullable=True)
    outcome: Mapped[str | None] = mapped_column(String, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    org = relationship("Organization", back_populates="calls")
    agent = relationship("Agent", back_populates="calls")
