"""
Documents API — upload, list, and delete knowledge-base documents.
"""

import base64
import logging
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Query

from app.services.kb_service import create_document, delete_document, get_documents
from app.tasks.documents import process_document_task

logger = logging.getLogger(__name__)
router = APIRouter()

ALLOWED_CONTENT_TYPES = {
    "text/plain",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload", status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    session_id: str = Form(...),
):
    """
    Upload a document (.txt, .pdf, .docx) to the knowledge base.

    The file is immediately stored as a Document row (status=pending).
    A Celery task then processes it asynchronously (parse → chunk → embed).
    """
    # Validate content type
    content_type = file.content_type or ""
    # Be lenient with DOCX — some browsers send application/octet-stream
    filename = file.filename or "upload"
    if filename.lower().endswith(".docx") and content_type not in ALLOWED_CONTENT_TYPES:
        content_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    if filename.lower().endswith(".pdf") and content_type not in ALLOWED_CONTENT_TYPES:
        content_type = "application/pdf"
    if filename.lower().endswith(".txt") and content_type not in ALLOWED_CONTENT_TYPES:
        content_type = "text/plain"

    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{content_type}'. Allowed: .txt, .pdf, .docx",
        )

    # Read raw bytes and enforce size limit
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(raw_bytes):,} bytes). Maximum is {MAX_FILE_SIZE:,} bytes.",
        )
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty file.")

    # Create DB record
    doc = await create_document(
        session_id=session_id,
        filename=filename,
        content_type=content_type,
    )

    # Enqueue background processing (base64-encode bytes for Celery's JSON serializer)
    raw_b64 = base64.b64encode(raw_bytes).decode("ascii")
    process_document_task.delay(doc.id, raw_b64, content_type)

    logger.info(
        f"[Documents] Uploaded '{filename}' ({len(raw_bytes):,} bytes) "
        f"as doc {doc.id} for session {session_id}"
    )

    return {
        "id": doc.id,
        "filename": doc.filename,
        "status": doc.status,
        "session_id": session_id,
    }


@router.get("/")
async def list_documents(session_id: str = Query(...)):
    """Return all documents for this session."""
    docs = await get_documents(session_id)
    return {"documents": docs, "count": len(docs)}


@router.delete("/{document_id}")
async def remove_document(document_id: int, session_id: str = Query(...)):
    """Delete a document and all its chunks."""
    success = await delete_document(document_id, session_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail=f"Document {document_id} not found for this session.",
        )
    return {"success": True, "document_id": document_id}
