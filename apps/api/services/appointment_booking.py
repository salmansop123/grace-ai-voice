import re
from datetime import datetime, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.appointment import Appointment

_ISO_BODY_PATTERN = re.compile(r"(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})")
_US_BODY_PATTERN = re.compile(
    r"(\d{1,2}/\d{1,2}/\d{4})[ ,T]+(\d{1,2}:\d{2})(?:\s*([AaPp][Mm]))?"
)


def _parse_datetime_candidate(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        pass
    for fmt in ("%Y-%m-%d %H:%M", "%m/%d/%Y %H:%M", "%m/%d/%Y %I:%M %p"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def _extract_starts_at_from_body(body: str) -> datetime | None:
    iso_match = _ISO_BODY_PATTERN.search(body)
    if iso_match:
        dt = _parse_datetime_candidate(f"{iso_match.group(1)} {iso_match.group(2)}")
        if dt is not None:
            return dt

    us_match = _US_BODY_PATTERN.search(body)
    if us_match:
        suffix = f" {us_match.group(3).upper()}" if us_match.group(3) else ""
        dt = _parse_datetime_candidate(f"{us_match.group(1)} {us_match.group(2)}{suffix}")
        if dt is not None:
            return dt
    return None


async def create_auto_appointment_from_message(
    *,
    db: AsyncSession,
    org_id: str,
    customer_name: str,
    customer_phone: str | None,
    channel: str,
    body: str,
    meta: dict,
) -> Appointment | None:
    channel_label = "sms" if channel == "text" else channel
    meta_appointment = meta.get("appointment") if isinstance(meta.get("appointment"), dict) else {}
    auto_enabled = bool(meta_appointment.get("auto_book")) or ("book" in body.lower() and "appointment" in body.lower())
    if not auto_enabled:
        return None

    starts_at = (
        _parse_datetime_candidate(str(meta_appointment.get("starts_at", "")).strip())
        or _parse_datetime_candidate(str(meta_appointment.get("start_at", "")).strip())
        or _parse_datetime_candidate(str(meta_appointment.get("appointment_time", "")).strip())
        or _extract_starts_at_from_body(body)
    )
    if starts_at is None:
        return None

    ends_at = (
        _parse_datetime_candidate(str(meta_appointment.get("ends_at", "")).strip())
        or _parse_datetime_candidate(str(meta_appointment.get("end_at", "")).strip())
        or starts_at + timedelta(minutes=30)
    )
    title = str(meta_appointment.get("title") or f"AI Booked Appointment ({channel_label.upper()})").strip()
    notes = str(meta_appointment.get("notes") or f"[AI-AUTO] Booked from {channel_label}: {body[:200]}").strip()

    duplicate = await db.execute(
        select(Appointment).where(
            and_(
                Appointment.org_id == org_id,
                Appointment.customer_name == customer_name,
                Appointment.title == title,
                Appointment.starts_at >= starts_at - timedelta(minutes=5),
                Appointment.starts_at <= starts_at + timedelta(minutes=5),
            )
        )
    )
    if duplicate.scalar_one_or_none() is not None:
        return None

    appointment = Appointment(
        org_id=org_id,
        customer_name=customer_name,
        customer_phone=customer_phone,
        title=title,
        notes=notes,
        starts_at=starts_at,
        ends_at=ends_at,
        status="booked",
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)
    return appointment


async def update_appointment_status_from_confirmation(
    *,
    db: AsyncSession,
    org_id: str,
    customer_name: str,
    customer_phone: str | None,
    body: str,
) -> Appointment | None:
    lowered = body.lower()
    next_status: str | None = None
    if any(token in lowered for token in ["done", "completed", "finished", "resolved"]):
        next_status = "completed"
    elif any(token in lowered for token in ["cancel", "canceled", "cancelled", "cannot make it"]):
        next_status = "cancelled"
    elif any(token in lowered for token in ["confirm", "confirmed", "booked"]):
        next_status = "booked"
    if next_status is None:
        return None

    query = select(Appointment).where(Appointment.org_id == org_id)
    if customer_phone:
        query = query.where(Appointment.customer_phone == customer_phone)
    else:
        query = query.where(Appointment.customer_name == customer_name)
    query = query.order_by(Appointment.starts_at.desc()).limit(1)
    appointment = (await db.execute(query)).scalar_one_or_none()
    if appointment is None:
        return None

    appointment.status = next_status
    await db.commit()
    await db.refresh(appointment)
    return appointment
