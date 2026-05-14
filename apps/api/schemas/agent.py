from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str = Field(min_length=1)
    voice_id: str
    system_prompt: str = Field(min_length=20)
    language: str = "en-US"
    llm_model: str = "gpt-4o"


class AgentUpdate(BaseModel):
    name: str | None = None
    voice_id: str | None = None
    system_prompt: str | None = None
    language: str | None = None
    llm_model: str | None = None
    is_active: bool | None = None
