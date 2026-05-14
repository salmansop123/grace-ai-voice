from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    clerk_org_id: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    plan: Mapped[str] = mapped_column(String, default="free")
    minutes_used: Mapped[int] = mapped_column(Integer, default=0)
    minutes_limit: Mapped[int] = mapped_column(Integer, default=500)
    twilio_acc_sid: Mapped[str | None] = mapped_column(String, nullable=True)
    stripe_id: Mapped[str | None] = mapped_column(String, nullable=True)
    crm_webhook_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    agents = relationship("Agent", back_populates="org")
    calls = relationship("Call", back_populates="org")
    contacts = relationship("Contact", back_populates="org")
    campaigns = relationship("Campaign", back_populates="org")
