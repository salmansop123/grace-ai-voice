from datetime import datetime, timedelta

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import and_, asc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db
from models.appointment import Appointment
from models.organization import Organization

router = APIRouter()


def _serialize_notes(notes: str | None) -> tuple[str | None, str]:
    value = notes or None
    if value and value.startswith("[AI-AUTO]"):
        return value.replace("[AI-AUTO]", "", 1).strip() or None, "ai"
    return value, "manual"


def _month_range(month: str | None) -> tuple[datetime, datetime]:
    if month:
        try:
            start = datetime.strptime(month, "%Y-%m")
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid month format. Use YYYY-MM."
            ) from exc
    else:
        now = datetime.utcnow()
        start = datetime(now.year, now.month, 1)

    if start.month == 12:
        next_month = datetime(start.year + 1, 1, 1)
    else:
        next_month = datetime(start.year, start.month + 1, 1)
    return start, next_month


@router.get("/jobs")
async def list_jobs(
    month: str | None = Query(default=None),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    start, end = _month_range(month)
    result = await db.execute(
        select(Appointment)
        .where(
            and_(
                Appointment.org_id == org.id,
                Appointment.starts_at >= start,
                Appointment.starts_at < end,
            )
        )
        .order_by(asc(Appointment.starts_at))
    )
    appointments = result.scalars().all()

    return [
        (
            lambda clean_notes, source: {
                "id": item.id,
                "customer_name": item.customer_name,
                "customer_phone": item.customer_phone,
                "title": item.title,
                "notes": clean_notes,
                "starts_at": item.starts_at.isoformat(),
                "ends_at": item.ends_at.isoformat(),
                "status": item.status,
                "source": source,
            }
        )(*_serialize_notes(item.notes))
        for item in appointments
    ]


@router.post("/jobs")
async def create_job(
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    customer_name = str(payload.get("customer_name", "")).strip()
    title = str(payload.get("title", "")).strip()
    starts_at_raw = payload.get("starts_at")
    ends_at_raw = payload.get("ends_at")
    source = str(payload.get("source", "manual")).lower()

    if not customer_name or not title or not starts_at_raw:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="customer_name, title and starts_at are required",
        )

    try:
        starts_at = datetime.fromisoformat(str(starts_at_raw))
        ends_at = (
            datetime.fromisoformat(str(ends_at_raw))
            if ends_at_raw
            else starts_at + timedelta(hours=1)
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid datetime format") from exc

    notes_raw = str(payload.get("notes", "") or "") or None
    notes_with_source = notes_raw
    if source == "ai" and notes_raw:
        notes_with_source = f"[AI-AUTO] {notes_raw}"
    elif source == "ai":
        notes_with_source = "[AI-AUTO] Auto-booked by Grace AI"

    item = Appointment(
        org_id=org.id,
        customer_name=customer_name,
        customer_phone=str(payload.get("customer_phone", "") or "") or None,
        title=title,
        notes=notes_with_source,
        starts_at=starts_at,
        ends_at=ends_at,
        status=str(payload.get("status", "booked")),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    clean_notes, derived_source = _serialize_notes(item.notes)
    return {
        "id": item.id,
        "customer_name": item.customer_name,
        "customer_phone": item.customer_phone,
        "title": item.title,
        "notes": clean_notes,
        "starts_at": item.starts_at.isoformat(),
        "ends_at": item.ends_at.isoformat(),
        "status": item.status,
        "source": derived_source,
    }


@router.patch("/jobs/{job_id}/status")
async def update_job_status(
    job_id: str,
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    next_status = str(payload.get("status", "")).lower().strip()
    allowed = {"booked", "completed", "cancelled"}
    if next_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="status must be one of: booked, completed, cancelled",
        )

    job = (
        await db.execute(
            select(Appointment).where(Appointment.id == job_id, Appointment.org_id == org.id)
        )
    ).scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")

    job.status = next_status
    await db.commit()
    await db.refresh(job)
    clean_notes, source = _serialize_notes(job.notes)
    return {
        "id": job.id,
        "customer_name": job.customer_name,
        "customer_phone": job.customer_phone,
        "title": job.title,
        "notes": clean_notes,
        "starts_at": job.starts_at.isoformat(),
        "ends_at": job.ends_at.isoformat(),
        "status": job.status,
        "source": source,
    }