import asyncio
import base64
import json
import time
from datetime import datetime
from types import SimpleNamespace
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select
from websockets.client import ClientConnection
from websockets.client import connect as ws_connect

from core.config import settings
from core.database import AsyncSessionLocal
from core.redis import redis_client
from models.agent import Agent
from models.call import Call
from services.twilio_service import twilio_client
import structlog
from voice.deepgram_client import open_deepgram_socket
from voice.elevenlabs_client import stream_tts_to_twilio
from voice.llm_engine import run_llm_turn

logger = structlog.get_logger()


async def voice_websocket_handler(websocket: WebSocket, call_sid: str) -> None:
    await websocket.accept()
    twilio_state: dict[str, str | None] = {"stream_sid": None}

    try:
        start_data = await _wait_for_start_event(websocket)
        start_payload = start_data.get("start", {})
        custom_params = start_payload.get("customParameters", {})
        agent_id = custom_params.get("agent_id")
        org_id = custom_params.get("org_id")
        call_db_id = custom_params.get("call_db_id")
        twilio_state["stream_sid"] = start_payload.get("streamSid")

        if not agent_id or not org_id:
            await websocket.close(code=1008, reason="Missing agent/org parameters")
            return

        agent = await _get_agent_with_cache(agent_id=agent_id, org_id=org_id)
        if agent is None:
            await websocket.close(code=1008, reason="Agent not found")
            return

        if call_db_id:
            async with AsyncSessionLocal() as db:
                call = (
                    await db.execute(
                        select(Call).where(Call.id == call_db_id, Call.org_id == org_id)
                    )
                ).scalar_one_or_none()
                if call is None:
                    await websocket.close(code=1008, reason="Call/org mismatch")
                    return

        redis_key = f"call:{org_id}:{call_sid}:messages"
        await redis_client.delete(redis_key)

        deepgram_ws = await open_deepgram_socket(settings.DEEPGRAM_API_KEY)
        try:
            greeting = f"Hello, this is {getattr(agent, 'name', 'Grace AI')}. How can I help you today?"
            await stream_tts_to_twilio(
                text=greeting,
                voice_id=agent.voice_id,
                twilio_ws=websocket,
                call_sid=call_sid,
                stream_sid=twilio_state.get("stream_sid"),
            )
            await asyncio.gather(
                receive_twilio_audio(websocket, deepgram_ws),
                process_transcripts(
                    deepgram_ws=deepgram_ws,
                    twilio_ws=websocket,
                    agent=agent,
                    call_sid=call_sid,
                    org_id=org_id,
                    twilio_state=twilio_state,
                ),
                send_heartbeat(websocket, twilio_state),
            )
        finally:
            await deepgram_ws.close()
            await redis_client.setex(f"call:{org_id}:{call_sid}:done", 3600, "1")
    except WebSocketDisconnect:
        return
    except Exception:
        await websocket.close(code=1011, reason="Voice stream error")


async def _wait_for_start_event(websocket: WebSocket) -> dict[str, Any]:
    while True:
        message = await websocket.receive_text()
        data = json.loads(message)
        if data.get("event") == "start":
            return data


async def _get_agent_with_cache(agent_id: str, org_id: str) -> Any | None:
    cache_key = f"agent:{org_id}:{agent_id}"
    cached = await redis_client.get(cache_key)
    if cached:
        parsed = json.loads(cached)
        if parsed.get("org_id") == org_id:
            return SimpleNamespace(**parsed)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Agent).where(Agent.id == agent_id, Agent.org_id == org_id)
        )
        agent = result.scalar_one_or_none()
        if agent is None:
            return None

        await redis_client.setex(
            cache_key,
            300,
            json.dumps(
                {
                    "id": agent.id,
                    "org_id": agent.org_id,
                    "name": agent.name,
                    "voice_id": agent.voice_id,
                    "language": agent.language,
                    "system_prompt": agent.system_prompt,
                    "llm_model": agent.llm_model,
                    "call_flow": agent.call_flow,
                    "phone_number": agent.phone_number,
                    "is_active": agent.is_active,
                    "created_at": agent.created_at.isoformat(),
                }
            ),
        )
        return agent


async def receive_twilio_audio(
    twilio_ws: WebSocket, deepgram_ws: ClientConnection
) -> None:
    async for message in twilio_ws.iter_text():
        data = json.loads(message)
        if data.get("event") == "media":
            payload = data.get("media", {}).get("payload")
            if payload:
                audio_bytes = base64.b64decode(payload)
                await deepgram_ws.send(audio_bytes)
        elif data.get("event") in ("stop", "disconnect"):
            await deepgram_ws.close()
            break


async def process_transcripts(
    deepgram_ws: ClientConnection,
    twilio_ws: WebSocket,
    agent: Any,
    call_sid: str,
    org_id: str,
    twilio_state: dict[str, str | None],
) -> None:
    redis_key = f"call:{org_id}:{call_sid}:messages"

    while True:
        raw = await deepgram_ws.recv()
        if not isinstance(raw, str):
            continue

        result = json.loads(raw)
        transcript = (
            result.get("channel", {})
            .get("alternatives", [{}])[0]
            .get("transcript", "")
            .strip()
        )
        if not transcript or not result.get("speech_final", False):
            continue

        await redis_client.rpush(
            redis_key, json.dumps({"role": "user", "content": transcript})
        )
        await redis_client.ltrim(redis_key, -20, -1)
        await redis_client.publish(
            f"live_calls:{org_id}",
            json.dumps(
                {
                    "call_sid": call_sid,
                    "role": "user",
                    "text": transcript,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ),
        )

        t0 = time.perf_counter()
        response_text, tool_used = await run_llm_turn(
            agent=agent,
            history_key=redis_key,
            org_id=org_id,
            call_sid=call_sid,
            redis=redis_client,
        )
        t1 = time.perf_counter()
        await redis_client.rpush(redis_key, json.dumps({"role": "assistant", "content": response_text}))
        await redis_client.ltrim(redis_key, -20, -1)
        await redis_client.publish(
            f"live_calls:{org_id}",
            json.dumps(
                {
                    "event": "transcript",
                    "call_sid": call_sid,
                    "role": "assistant",
                    "text": response_text,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            ),
        )
        await stream_tts_to_twilio(
            text=response_text,
            voice_id=agent.voice_id,
            twilio_ws=twilio_ws,
            call_sid=call_sid,
            stream_sid=twilio_state.get("stream_sid"),
        )
        t2 = time.perf_counter()
        logger.info(
            "pipeline_latency",
            call_sid=call_sid,
            org_id=org_id,
            event="voice_turn",
            stt_to_llm_ms=round((t1 - t0) * 1000, 2),
            llm_to_tts_ms=round((t2 - t1) * 1000, 2),
            total_ms=round((t2 - t0) * 1000, 2),
        )
        if tool_used == "end_call":
            await asyncio.sleep(1.5)
            try:
                twilio_client.calls(call_sid).update(status="completed")
            except Exception:
                pass
            break


async def send_heartbeat(
    twilio_ws: WebSocket, twilio_state: dict[str, str | None]
) -> None:
    while True:
        await asyncio.sleep(10)
        stream_sid = twilio_state.get("stream_sid")
        if stream_sid:
            await twilio_ws.send_text(
                json.dumps(
                    {
                        "event": "mark",
                        "streamSid": stream_sid,
                        "mark": {"name": "heartbeat"},
                    }
                )
            )
