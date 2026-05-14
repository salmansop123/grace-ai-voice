import asyncio
from uuid import uuid4

from openai import AsyncOpenAI
from pinecone import Pinecone

from core.config import settings

openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


def _get_pinecone_index():
    if not settings.PINECONE_API_KEY or not settings.PINECONE_INDEX:
        return None
    try:
        client = Pinecone(api_key=settings.PINECONE_API_KEY)
        return client.Index(settings.PINECONE_INDEX)
    except Exception:
        return None


async def _embed_texts(texts: list[str]) -> list[list[float]]:
    response = await openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return [item.embedding for item in response.data]


async def query_pinecone(query: str, namespace: str) -> list[str]:
    pinecone_index = _get_pinecone_index()
    if pinecone_index is None:
        return []
    try:
        embeddings = await _embed_texts([query])
        query_vector = embeddings[0]
        result = await asyncio.to_thread(
            pinecone_index.query,
            namespace=namespace,
            vector=query_vector,
            top_k=5,
            include_metadata=True,
        )
        matches = result.get("matches", []) if isinstance(result, dict) else getattr(result, "matches", [])
        contexts: list[str] = []
        for match in matches:
            metadata = match.get("metadata", {}) if isinstance(match, dict) else getattr(match, "metadata", {})
            text = metadata.get("text") if isinstance(metadata, dict) else None
            if text:
                contexts.append(str(text))
        return contexts
    except Exception:
        return []


async def upsert_document_chunks(
    namespace: str, document_id: str, chunks: list[str]
) -> list[str]:
    chunk_ids = [f"{document_id}_chunk_{index}_{uuid4().hex[:8]}" for index, _chunk in enumerate(chunks)]
    pinecone_index = _get_pinecone_index()
    if pinecone_index is None:
        return chunk_ids
    try:
        vectors = await _embed_texts(chunks)
        upsert_payload = [
            {
                "id": chunk_id,
                "values": vector,
                "metadata": {
                    "document_id": document_id,
                    "text": chunk,
                },
            }
            for chunk_id, chunk, vector in zip(chunk_ids, chunks, vectors, strict=False)
        ]
        await asyncio.to_thread(
            pinecone_index.upsert,
            vectors=upsert_payload,
            namespace=namespace,
        )
    except Exception:
        pass
    return chunk_ids


async def upsert_qa_pair(
    namespace: str,
    document_id: str,
    question: str,
    answer: str,
    source: str,
    source_id: str | None = None,
) -> list[str]:
    text = f"Q: {question}\nA: {answer}"
    chunk_id = f"{document_id}_qa_{uuid4().hex[:8]}"
    pinecone_index = _get_pinecone_index()
    if pinecone_index is None:
        return [chunk_id]
    try:
        vectors = await _embed_texts([text])
        await asyncio.to_thread(
            pinecone_index.upsert,
            vectors=[
                {
                    "id": chunk_id,
                    "values": vectors[0],
                    "metadata": {
                        "document_id": document_id,
                        "text": text,
                        "source": source,
                        "source_id": source_id,
                        "type": "qa",
                    },
                }
            ],
            namespace=namespace,
        )
    except Exception:
        pass
    return [chunk_id]
