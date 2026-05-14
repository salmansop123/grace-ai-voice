from datetime import datetime

from pydantic import BaseModel


class CampaignCreate(BaseModel):
    agent_id: str
    name: str
    contact_ids: list[str]
    scheduled: datetime | None = None
