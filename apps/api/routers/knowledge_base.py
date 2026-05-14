from uuid import uuid4

import fitz
from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.deps import get_current_org, get_db, require_admin
from core.plan_limits import ensure_plan_resource_available
from models.agent import Agent
from models.kb_document import KBDocument
from models.organization import Organization
from services.pinecone_service import upsert_document_chunks

router = APIRouter()


def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 120) -> list[str]:
    cleaned = " ".join(text.split())
    if not cleaned:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + chunk_size)
        chunks.append(cleaned[start:end])
        if end == len(cleaned):
            break
        start = max(0, end - overlap)
    return chunks


def _extract_text_from_file(file_name: str, data: bytes) -> str:
    if file_name.lower().endswith(".pdf"):
        document = fitz.open(stream=data, filetype="pdf")
        try:
            return "\n".join(page.get_text() for page in document)
        finally:
            document.close()
    return data.decode("utf-8", errors="ignore")


@router.get("/{agent_id}")
async def list_docs(
    agent_id: str,
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    agent_result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    if agent_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    result = await db.execute(
        select(KBDocument)
        .where(KBDocument.agent_id == agent_id)
        .order_by(desc(KBDocument.created_at))
        .limit(200)
    )
    docs = result.scalars().all()
    return [
        {
            "id": doc.id,
            "agent_id": doc.agent_id,
            "file_name": doc.file_name,
            "content_preview": doc.content[:140],
            "chunk_ids": doc.chunk_ids or [],
            "created_at": doc.created_at.isoformat(),
        }
        for doc in docs
    ]


@router.post("/{agent_id}")
async def create_doc(
    agent_id: str,
    payload: dict = Body(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await ensure_plan_resource_available(db, org, "kb_docs")
    agent_result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    if agent_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    file_name = str(payload.get("file_name", "")).strip()
    content = str(payload.get("content", "")).strip()
    if not file_name or not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="file_name and content are required",
        )

    doc = KBDocument(
        agent_id=agent_id,
        file_name=file_name,
        content=content,
        chunk_ids=[],
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return {
        "id": doc.id,
        "agent_id": doc.agent_id,
        "file_name": doc.file_name,
        "content_preview": doc.content[:140],
        "chunk_ids": doc.chunk_ids or [],
        "created_at": doc.created_at.isoformat(),
    }


@router.post("/upload/{agent_id}")
async def upload_doc(
    agent_id: str,
    file: UploadFile = File(...),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await ensure_plan_resource_available(db, org, "kb_docs")
    agent_result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    agent = agent_result.scalar_one_or_none()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing file name")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    extracted_text = _extract_text_from_file(file.filename, file_bytes).strip()
    if not extracted_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not extract text from file")

    chunks = _chunk_text(extracted_text)
    if not chunks:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No usable text chunks found")

    doc = KBDocument(
        id=str(uuid4()),
        agent_id=agent_id,
        file_name=file.filename,
        content=extracted_text,
        chunk_ids=[],
    )
    doc.chunk_ids = await upsert_document_chunks(
        namespace=f"{org.id}-{agent_id}",
        document_id=doc.id,
        chunks=chunks,
    )

    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return {
        "id": doc.id,
        "agent_id": doc.agent_id,
        "file_name": doc.file_name,
        "content_preview": doc.content[:140],
        "chunk_ids": doc.chunk_ids or [],
        "created_at": doc.created_at.isoformat(),
    }


@router.delete("/{agent_id}/{doc_id}")
async def delete_doc(
    agent_id: str,
    doc_id: str,
    _admin: object = Depends(require_admin),
    org: Organization = Depends(get_current_org),
    db: AsyncSession = Depends(get_db),
) -> dict:
    agent_result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.org_id == org.id)
    )
    if agent_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    doc_result = await db.execute(
        select(KBDocument).where(KBDocument.id == doc_id, KBDocument.agent_id == agent_id)
    )
    doc = doc_result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    await db.delete(doc)
    await db.commit()
    return {"message": "Document deleted", "id": doc_id}
