from pydantic import BaseModel


class ContactCreate(BaseModel):
    name: str
    phone: str
    email: str | None = None
    tags: list[str] = []
    notes: str | None = None
