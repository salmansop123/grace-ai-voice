from datetime import datetime
from typing import Any

from sqlalchemy.sql import select

from core.database import AsyncSessionLocal
from models.contact import Contact


async def capture_lead(**kwargs: Any) -> dict[str, Any]:
    required = ["name", "phone"]
    missing = [field for field in required if not kwargs.get(field)]
    if missing:
        return {
            "status": "error",
            "tool": "capture_lead",
            "message": f"Missing required fields: {', '.join(missing)}",
        }

    org_id = kwargs.get("org_id")
    lead_payload = {
        "name": kwargs.get("name"),
        "phone": kwargs.get("phone"),
        "email": kwargs.get("email"),
        "interest": kwargs.get("interest"),
        "notes": kwargs.get("notes"),
        "captured_at": datetime.utcnow().isoformat(),
    }

    if org_id:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Contact).where(
                    Contact.org_id == org_id, Contact.phone == str(kwargs.get("phone"))
                )
            )
            contact = result.scalar_one_or_none()
            if contact is None:
                contact = Contact(
                    org_id=org_id,
                    name=str(kwargs.get("name")),
                    phone=str(kwargs.get("phone")),
                    email=kwargs.get("email"),
                    notes=kwargs.get("notes"),
                    tags=["lead"],
                )
                db.add(contact)
            else:
                existing_tags = set(contact.tags or [])
                existing_tags.add("lead")
                contact.tags = sorted(existing_tags)
                if kwargs.get("email"):
                    contact.email = str(kwargs.get("email"))
                if kwargs.get("notes"):
                    contact.notes = str(kwargs.get("notes"))
            await db.commit()

    return {
        "status": "success",
        "tool": "capture_lead",
        "lead": lead_payload,
        "message": "Lead captured successfully.",
    }
