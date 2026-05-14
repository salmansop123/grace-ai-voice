import base64
import json

import httpx

from core.config import settings


async def stream_tts_to_twilio(
    text: str,
    voice_id: str,
    twilio_ws: object,
    call_sid: str,
    stream_sid: str | None = None,
) -> None:
    if not text.strip():
        return

    safe_stream_sid = stream_sid or call_sid
    payload = {
        "text": text,
        "model_id": "eleven_turbo_v2",
        "output_format": "ulaw_8000",
        "optimize_streaming_latency": 3,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
        async with client.stream(
            "POST",
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream",
            headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
            json=payload,
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes(chunk_size=640):
                if not chunk:
                    continue
                await twilio_ws.send_text(
                    json.dumps(
                        {
                            "event": "media",
                            "streamSid": safe_stream_sid,
                            "media": {
                                "payload": base64.b64encode(chunk).decode("utf-8")
                            },
                        }
                    )
                )

    await twilio_ws.send_text(
        json.dumps(
            {
                "event": "mark",
                "streamSid": safe_stream_sid,
                "mark": {"name": "done"},
            }
        )
    )
