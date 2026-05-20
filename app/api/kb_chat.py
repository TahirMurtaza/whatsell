"""
Knowledge Base Chat API — strict RAG streaming endpoint.
Answers questions ONLY from uploaded documents for the given session.
"""

import logging
from typing import List, Optional

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.kb_service import kb_chat

logger = logging.getLogger(__name__)
router = APIRouter()


class HistoryMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class KBChatRequest(BaseModel):
    session_id: str
    message: str
    history: Optional[List[HistoryMessage]] = None


@router.post("/chat")
async def knowledge_base_chat(payload: KBChatRequest):
    """
    Stream an AI response sourced strictly from uploaded knowledge-base documents.

    The model will refuse to answer anything not found in the uploaded documents.
    """
    logger.info(
        f"[KB Chat] session={payload.session_id} message='{payload.message[:60]}'"
    )

    history = [{"role": m.role, "content": m.content} for m in (payload.history or [])]

    async def stream_generator():
        async for token in kb_chat(
            session_id=payload.session_id,
            message=payload.message,
            history=history,
        ):
            yield token

    return StreamingResponse(
        stream_generator(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
