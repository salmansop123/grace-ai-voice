import asyncio
import json
import math
from datetime import datetime

import boto3
import httpx
from openai import AsyncOpenAI
from redis import Redis
from sqlalchemy import select

from core.config import settings
from core.database import AsyncSessionLocal
from models.call import Call
from models.organization import Organization
from services.twilio_service import twilio_client
from workers.celery_app import celery_app

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def _process_call_end_async(call_sid: str, org_id: str, call_db_id: str) -> dict[str, str]:
    redis_sync = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    redis_key = f"call:{org_id}:{call_sid}:messages"
    transcript_raw = redis_sync.lrange(redis_key, 0, -1)
    transcript = [json.loads(item) for item in transcript_raw]

    sentiment = "neutral"
    outcome = "completed"
    summary = "No summary available."

    if transcript:
        transcript_text = "\n".join(
            f"{msg.get('role', 'unknown')}: {msg.get('content', '')}" for msg in transcript
        )
        try:
            analysis = await openai_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Analyze this call transcript and return strict JSON with keys "
                            "sentiment (positive|neutral|negative), outcome "
                            "(booked|lead|no-answer|transferred|completed), and summary "
                            "(max 3 sentences)."
                        ),
                    },
                    {"role": "user", "content": transcript_text},
                ],
                response_format={"type": "json_object"},
            )
            parsed = json.loads(analysis.choices[0].message.content or "{}")
            sentiment = parsed.get("sentiment", sentiment)
            outcome = parsed.get("outcome", outcome)
            summary = parsed.get("summary", summary)
        except Exception:
            pass

    async with AsyncSessionLocal() as db:
        call_result = await db.execute(
            select(Call).where(Call.id == call_db_id, Call.org_id == org_id)
        )
        call = call_result.scalar_one_or_none()
        if call is not None:
            call.transcript = transcript
            call.sentiment = sentiment
            call.outcome = outcome
            call.summary = summary
            call.status = "completed"
            call.duration = call.duration or 0

            org_result = await db.execute(select(Organization).where(Organization.id == org_id))
            org = org_result.scalar_one_or_none()
            if org is not None:
                minutes_delta = max(1, math.ceil((call.duration or 0) / 60)) if call.duration else 0
                if minutes_delta > 0:
                    redis_sync.incrbyfloat(f"org:{org_id}:minutes_today", minutes_delta / 60)
                org.minutes_used = (org.minutes_used or 0) + minutes_delta

            await db.commit()

            try:
                recordings = twilio_client.recordings.list(call_sid=call_sid, limit=1)
                if recordings:
                    rec = recordings[0]
                    audio_url = f"https://api.twilio.com{rec.uri.replace('.json', '.mp3')}"
                    audio_resp = httpx.get(
                        audio_url,
                        auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                        timeout=20.0,
                    )
                    if audio_resp.status_code == 200:
                        r2_client = boto3.client(
                            "s3",
                            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                            region_name="auto",
                        )
                        r2_key = f"recordings/{org_id}/{call_db_id}.mp3"
                        r2_client.put_object(
                            Bucket=settings.R2_BUCKET_NAME,
                            Key=r2_key,
                            Body=audio_resp.content,
                            ContentType="audio/mpeg",
                        )
                        call.recording_url = (
                            f"https://{settings.R2_BUCKET_NAME}.{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{r2_key}"
                        )
                        await db.commit()
            except Exception:
                pass

            org_result = await db.execute(select(Organization).where(Organization.id == org_id))
            org = org_result.scalar_one_or_none()
            if org and org.crm_webhook_url and call.outcome in ("booked", "lead"):
                try:
                    httpx.post(
                        org.crm_webhook_url,
                        json={
                            "event": call.outcome,
                            "call_sid": call_sid,
                            "from": call.from_number,
                            "to": call.to_number,
                            "duration": call.duration,
                            "summary": call.summary,
                            "transcript": transcript,
                            "timestamp": datetime.utcnow().isoformat(),
                        },
                        timeout=10.0,
                    )
                except Exception:
                    pass

    redis_sync.delete(redis_key)
    redis_sync.delete(f"call:{org_id}:{call_sid}:done")
    return {"message": "post-call processing completed", "call_sid": call_sid}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_call_end(self: object, call_sid: str, org_id: str, call_db_id: str) -> dict[str, str]:
    try:
        return asyncio.run(
            _process_call_end_async(call_sid=call_sid, org_id=org_id, call_db_id=call_db_id)
        )
    except Exception as exc:
        raise self.retry(exc=exc)
