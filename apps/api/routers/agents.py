from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import and_, exists, or_, select
from sqlalchemy.orm import aliased
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db, require_admin
from core.plan_limits import ensure_plan_resource_available
from core.redis import redis_client
from models.agent import Agent
from models.call import Call
from models.contact import Contact
from models.conversation_message import ConversationMessage
from models.kb_document import KBDocument
from models.organization import Organization
from schemas.agent import AgentCreate, AgentUpdate
from services.pinecone_service import upsert_qa_pair

router = APIRouter()


def _normalize_phone_number(value: str) -> str:
    raw = str(value or "").strip()
    digits = "".join(char for char in raw if char.isdigit())
    if len(digits) < 8 or len(digits) > 15:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="phone_number must be E.164 format (e.g. +15551234567)",
        )
    return f"+{digits}"


@router.get("")
async def list_agents(
    org: Organization = Depends(get_current_org), db: AsyncSession = Depends(get_db)
) -> list[dict]:
    result = await db.execute(select(Agent).where(Agent.org_id == org.id))
    agents = result.scalars().all()
    return [
        {
            "id": agent.id,
            "name": agent.name,
            "voice_id": agent.voice_id,
            "language": agent.language,
            "llm_model": agent.llm_model,
            "phone_number": agent.phone_number,
            "is_active": agent.is_active,
            "created_at": agent.created_at.isoformat(),
        }
        for agent in agents
    ]


@router.post("")
async def create_agent(
    payload: AgentCreate,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await ensure_plan_resource_available(db, org, "agents")
    agent = Agent(
        org_id=org.id,
        name=payload.name,
        voice_id=payload.voice_id,
        system_prompt=payload.system_prompt,
        language=payload.language,
        llm_model=payload.llm_model,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return {
        "id": agent.id,
        "name": agent.name,
        "voice_id": agent.voice_id,
        "system_prompt": agent.system_prompt,
        "language": agent.language,
        "llm_model": agent.llm_model,
        "phone_number": agent.phone_number,
        "is_active": agent.is_active,
    }


@router.get("/{agent_id}")
async def get_agent(
    agent_id: str,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return {
        "id": agent.id,
        "name": agent.name,
        "voice_id": agent.voice_id,
        "system_prompt": agent.system_prompt,
        "language": agent.language,
        "llm_model": agent.llm_model,
        "call_flow": agent.call_flow,
        "phone_number": agent.phone_number,
        "is_active": agent.is_active,
        "created_at": agent.created_at.isoformat(),
    }


@router.put("/{agent_id}")
async def update_agent(
    agent_id: str,
    payload: AgentUpdate,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    updates = payload.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(agent, key, value)
    await db.commit()
    await db.refresh(agent)
    return {"message": "Agent updated", "id": agent.id}


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: str,
    _admin: object = Depends(require_admin),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # Cleanup multi-number assignment mappings in Redis before deleting the agent.
    agent_numbers_key = f"org:{org.id}:agent:{agent.id}:assigned_numbers"
    assigned_numbers = await redis_client.smembers(agent_numbers_key)
    for number in assigned_numbers:
        await redis_client.delete(f"org:{org.id}:assigned_number:{number}")
        await redis_client.delete(f"assigned_number:{number}")
    await redis_client.delete(agent_numbers_key)

    await db.delete(agent)
    await db.commit()
    return {"message": "Agent deleted", "id": agent_id}


@router.put("/{agent_id}/flow")
async def save_agent_flow(
    agent_id: str,
    flow: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    agent.call_flow = flow
    await db.commit()
    return {"message": "Flow saved", "id": agent.id}


@router.post("/{agent_id}/assign-number")
async def assign_number(
    agent_id: str,
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    number = _normalize_phone_number(payload.get("phone_number"))

    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    agent = result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    purchased_key = f"org:{org.id}:purchased_numbers"
    purchased_numbers = set(await redis_client.smembers(purchased_key))
    if number not in purchased_numbers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number must be purchased before assignment",
        )

    number_owner_key = f"org:{org.id}:assigned_number:{number}"
    existing_owner = await redis_client.get(number_owner_key)
    if existing_owner and existing_owner != agent.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Number is already assigned to another agent",
        )

    agent_numbers_key = f"org:{org.id}:agent:{agent.id}:assigned_numbers"
    await redis_client.sadd(agent_numbers_key, number)
    await redis_client.set(number_owner_key, agent.id)
    await redis_client.set(f"assigned_number:{number}", agent.id)

    if not agent.phone_number:
        # Keep a primary number for existing outbound call paths.
        agent.phone_number = number
    await db.commit()
    return {"message": "Phone number assigned", "id": agent.id, "phone_number": number}


@router.get("/{agent_id}/unanswered-questions")
async def unanswered_questions(
    agent_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    agent = (
        await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id))
    ).scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    customer_msg = aliased(ConversationMessage)
    agent_reply = aliased(ConversationMessage)

    customer_messages = (
        await db.execute(
            select(customer_msg, Contact.name)
            .join(Contact, Contact.id == customer_msg.contact_id, isouter=True)
            .where(
                customer_msg.org_id == org.id,
                customer_msg.sender_role == "customer",
                or_(
                    customer_msg.meta["intent_matched"].astext == "false",
                    customer_msg.meta["intent_matched"].astext.is_(None),
                ),
                ~exists(
                    select(agent_reply.id).where(
                        and_(
                            agent_reply.thread_id == customer_msg.thread_id,
                            agent_reply.sender_role.in_(["agent_ai", "agent_human"]),
                            agent_reply.created_at > customer_msg.created_at,
                        )
                    )
                ),
            )
            .order_by(customer_msg.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()

    phrases = ["i don't know", "i am not sure", "i'm not sure", "not sure about that"]
    calls = (
        await db.execute(
            select(Call, Contact.name)
            .join(Contact, Contact.phone == Call.from_number, isouter=True)
            .where(Call.org_id == org.id, Call.agent_id == agent_id)
            .order_by(Call.created_at.desc())
            .limit(200)
        )
    ).all()

    payload: list[dict] = []
    for message, contact_name in customer_messages:
        payload.append(
            {
                "id": message.id,
                "source": "inbox",
                "content": message.body,
                "timestamp": message.created_at.isoformat(),
                "contact_name": contact_name or "Unknown customer",
            }
        )

    for call, contact_name in calls:
        transcript = call.transcript or []
        for item in transcript:
            role = str(item.get("role", "")).lower()
            content = str(item.get("content", "")).strip()
            if role not in {"assistant", "agent_ai"} or not content:
                continue
            lowered = content.lower()
            if any(phrase in lowered for phrase in phrases):
                payload.append(
                    {
                        "id": call.id,
                        "source": "call",
                        "content": content,
                        "timestamp": call.created_at.isoformat(),
                        "contact_name": contact_name or call.from_number,
                    }
                )
                break

    payload.sort(key=lambda item: item["timestamp"], reverse=True)
    return payload[:limit]


@router.post("/{agent_id}/knowledge-base")
async def add_knowledge_base_qa(
    agent_id: str,
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    agent = (
        await db.execute(select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id))
    ).scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    question = str(payload.get("question", "")).strip()
    answer = str(payload.get("answer", "")).strip()
    source = str(payload.get("source", "manual")).strip().lower()
    source_id = payload.get("source_id")
    if not question or not answer:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="question and answer are required")
    if source not in {"manual", "call", "inbox"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid source")

    content = f"Q: {question}\nA: {answer}"
    doc = KBDocument(
        agent_id=agent_id,
        file_name=f"qa_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.txt",
        content=content,
        source=source,
        source_id=str(source_id) if source_id is not None else None,
    )
    db.add(doc)
    await db.flush()

    namespace = f"{org.id}-{agent_id}"
    chunk_ids = await upsert_qa_pair(
        namespace=namespace,
        document_id=doc.id,
        question=question,
        answer=answer,
        source=source,
        source_id=str(source_id) if source_id is not None else None,
    )
    doc.chunk_ids = chunk_ids
    await db.commit()
    await db.refresh(doc)
    return {
        "id": doc.id,
        "agent_id": doc.agent_id,
        "file_name": doc.file_name,
        "content_preview": doc.content[:180],
        "chunk_ids": doc.chunk_ids,
        "source": doc.source,
        "source_id": doc.source_id,
        "created_at": doc.created_at.isoformat(),
    }


@router.post("/{agent_id}/kb-from-question")
async def kb_from_question(
    agent_id: str,
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    question = str(payload.get("question", "")).strip()
    if not question:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="question is required")
    source_id = payload.get("source_id")
    source_type = str(payload.get("source_type", "inbox")).lower()
    return await add_knowledge_base_qa(
        agent_id=agent_id,
        payload={
            "question": question,
            "answer": str(payload.get("answer", "Placeholder answer")).strip() or "Placeholder answer",
            "source": source_type if source_type in {"call", "inbox"} else "inbox",
            "source_id": source_id,
        },
        org=org,
        db=db,
    )
