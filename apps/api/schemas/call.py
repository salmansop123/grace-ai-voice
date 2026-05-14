from pydantic import BaseModel


class OutboundCallRequest(BaseModel):
    agent_id: str
    to_number: str
