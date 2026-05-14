from datetime import datetime
from typing import Any

from sqlalchemy.sql import select

from core.database import AsyncSessionLocal
from models.contact import Contact


async def book_appointment(**kwargs: Any) -> dict[str, Any]:
    required = ["contact_name", "phone", "date", "time"]
    missing = [field for field in required if not kwargs.get(field)]
    if missing:
        return {
            "status": "error",
            "tool": "book_appointment",
            "message": f"Missing required fields: {', '.join(missing)}",
        }

    org_id = kwargs.get("org_id")
    notes = kwargs.get("notes", "")
    appointment_note = f"Appointment requested for {kwargs.get('date')} {kwargs.get('time')}. {notes}".strip()

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
                    name=str(kwargs.get("contact_name")),
                    phone=str(kwargs.get("phone")),
                    notes=appointment_note,
                    tags=["appointment"],
                )
                db.add(contact)
            else:
                existing_tags = set(contact.tags or [])
                existing_tags.add("appointment")
                contact.tags = sorted(existing_tags)
                contact.notes = (
                    f"{contact.notes}\n{appointment_note}".strip()
                    if contact.notes
                    else appointment_note
                )
            await db.commit()

    return {
        "status": "success",
        "tool": "book_appointment",
        "appointment": {
            "contact_name": kwargs.get("contact_name"),
            "phone": kwargs.get("phone"),
            "date": kwargs.get("date"),
            "time": kwargs.get("time"),
            "notes": notes,
            "created_at": datetime.utcnow().isoformat(),
        },
        "message": "Appointment captured and queued for confirmation.",
    }
