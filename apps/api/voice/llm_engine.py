import json
from typing import Any

from openai import AsyncOpenAI

from core.config import settings
from core.redis import redis_client
from services.pinecone_service import query_pinecone
from voice.tools.book_appointment import book_appointment
from voice.tools.capture_lead import capture_lead
from voice.tools.end_call import end_call
from voice.tools.send_sms import send_sms
from voice.tools.transfer_human import transfer_to_human

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

TOOL_DEFINITIONS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "book_appointment",
            "description": "Book a calendar appointment for the caller",
            "parameters": {
                "type": "object",
                "required": ["contact_name", "phone", "date", "time"],
                "properties": {
                    "contact_name": {"type": "string"},
                    "phone": {"type": "string"},
                    "date": {"type": "string", "description": "YYYY-MM-DD"},
                    "time": {"type": "string", "description": "HH:MM 24h"},
                    "notes": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "capture_lead",
            "description": "Save caller as a lead in the CRM",
            "parameters": {
                "type": "object",
                "required": ["name", "phone"],
                "properties": {
                    "name": {"type": "string"},
                    "phone": {"type": "string"},
                    "email": {"type": "string"},
                    "interest": {"type": "string"},
                    "notes": {"type": "string"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_sms",
            "description": "Send an SMS message to the caller",
            "parameters": {
                "type": "object",
                "required": ["to", "message"],
                "properties": {"to": {"type": "string"}, "message": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "transfer_to_human",
            "description": "Transfer the call to a human agent",
            "parameters": {
                "type": "object",
                "required": ["reason"],
                "properties": {"reason": {"type": "string"}, "department": {"type": "string"}},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "end_call",
            "description": "End the call with a specific outcome",
            "parameters": {
                "type": "object",
                "required": ["reason", "outcome"],
                "properties": {
                    "reason": {"type": "string"},
                    "outcome": {
                        "type": "string",
                        "enum": ["booked", "lead", "no-answer", "transferred", "completed"],
                    },
                },
            },
        },
    },
]


async def _execute_tool(
    agent: Any,
    org_id: str,
    call_sid: str,
    tool_name: str,
    arguments: dict[str, Any],
) -> dict[str, Any]:
    arguments.setdefault("org_id", org_id)
    arguments.setdefault("call_sid", call_sid)
    arguments.setdefault("agent_id", getattr(agent, "id", None))

    if tool_name == "book_appointment":
        return await book_appointment(**arguments)
    if tool_name == "capture_lead":
        return await capture_lead(**arguments)
    if tool_name == "send_sms":
        arguments.setdefault("from_number", getattr(agent, "phone_number", None))
        return await send_sms(**arguments)
    if tool_name == "transfer_to_human":
        return await transfer_to_human(**arguments)
    if tool_name == "end_call":
        return await end_call(**arguments)
    return {"status": "error", "message": f"Unknown tool: {tool_name}"}


async def run_llm(agent: Any, call_sid: str, org_id: str, user_text: str) -> str:
    redis_key = f"call:{org_id}:{call_sid}:messages"
    history = [json.loads(item) for item in await redis_client.lrange(redis_key, 0, -1)]

    context_chunks = await query_pinecone(user_text, namespace=f"{org_id}-{agent.id}")
    rag_context = "\n".join(context_chunks)

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": f"{agent.system_prompt}\n\nKnowledge:\n{rag_context}",
        },
        *history,
    ]

    try:
        response = await openai_client.chat.completions.create(
            model=agent.llm_model,
            messages=messages,
            tools=TOOL_DEFINITIONS,
            tool_choice="auto",
            stream=False,
        )
    except Exception:
        reply = "Sorry, I had trouble processing that. Could you repeat that?"
        await redis_client.rpush(redis_key, json.dumps({"role": "assistant", "content": reply}))
        return reply

    message = response.choices[0].message
    if message.tool_calls:
        tool_call = message.tool_calls[0]
        tool_args = json.loads(tool_call.function.arguments or "{}")
        tool_result = await _execute_tool(
            agent=agent,
            org_id=org_id,
            call_sid=call_sid,
            tool_name=tool_call.function.name,
            arguments=tool_args,
        )

        follow_up_messages = [
            *messages,
            {
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                        },
                    }
                ],
            },
            {
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(tool_result),
            },
        ]
        follow_up = await openai_client.chat.completions.create(
            model=agent.llm_model,
            messages=follow_up_messages,
            stream=False,
        )
        reply = follow_up.choices[0].message.content or "Done."
    else:
        reply = message.content or "Okay."

    await redis_client.rpush(redis_key, json.dumps({"role": "assistant", "content": reply}))
    await redis_client.ltrim(redis_key, -20, -1)
    return reply


async def run_llm_turn(
    agent: Any,
    history_key: str,
    org_id: str,
    call_sid: str,
    redis: Any,
) -> tuple[str, str | None]:
    raw_msgs = await redis.lrange(history_key, 0, -1)
    history = [json.loads(m) for m in raw_msgs if json.loads(m).get("role") != "system"]
    last_user = next((m.get("content", "") for m in reversed(history) if m.get("role") == "user"), "")

    rag_context = ""
    if last_user:
        try:
            context_chunks = await query_pinecone(last_user, namespace=f"{org_id}-{agent.id}")
            rag_context = "\n".join(context_chunks)
        except Exception:
            rag_context = ""

    system_content = agent.system_prompt
    if rag_context:
        system_content += f"\n\nRelevant knowledge:\n{rag_context}"
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_content}, *history]

    response = await openai_client.chat.completions.create(
        model=agent.llm_model,
        messages=messages,
        tools=TOOL_DEFINITIONS,
        tool_choice="auto",
        max_tokens=300,
    )
    choice = response.choices[0]
    tool_used: str | None = None

    if choice.finish_reason == "tool_calls" and choice.message.tool_calls:
        tool_call = choice.message.tool_calls[0]
        tool_name = tool_call.function.name
        tool_args = json.loads(tool_call.function.arguments or "{}")
        tool_used = tool_name
        tool_result = await _execute_tool(
            agent=agent,
            org_id=org_id,
            call_sid=call_sid,
            tool_name=tool_name,
            arguments=tool_args,
        )
        messages.append(
            {
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": tool_call.id,
                        "type": "function",
                        "function": {
                            "name": tool_call.function.name,
                            "arguments": tool_call.function.arguments,
                        },
                    }
                ],
            }
        )
        messages.append(
            {
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(tool_result),
            }
        )
        follow_up = await openai_client.chat.completions.create(
            model=agent.llm_model, messages=messages, max_tokens=200
        )
        reply = follow_up.choices[0].message.content or "Done."
    else:
        reply = choice.message.content or "I'm here, please continue."

    return reply, tool_used
