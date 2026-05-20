"""
Celery task: process an uploaded document in the background.
Parses text, chunks it, generates Gemini embeddings, and stores them in PostgreSQL.

Note: raw_b64 is base64-encoded file content (safe for Celery's JSON serializer,
which can't handle arbitrary bytes — especially for binary files like PDFs).
"""

import base64
import logging

from app.tasks.celery import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    name="app.tasks.documents.process_document_task",
    max_retries=3,
    default_retry_delay=30,
    soft_time_limit=300,
)
def process_document_task(self, document_id: int, raw_b64: str, content_type: str):
    """
    Background task: parse → chunk → embed → store a knowledge-base document.

    Args:
        document_id: PK of the Document row (status must be 'pending')
        raw_b64:     base64-encoded file content
        content_type: MIME type (e.g. 'application/pdf')
    """
    try:
        from app.services.kb_service import process_document_sync

        raw_bytes = base64.b64decode(raw_b64)
        logger.info(
            f"[KB Task] Processing document {document_id} "
            f"({len(raw_bytes):,} bytes, {content_type})"
        )
        process_document_sync(document_id, raw_bytes, content_type)
        logger.info(f"[KB Task] Finished processing document {document_id}")

    except Exception as exc:
        logger.error(
            f"[KB Task] Failed to process document {document_id}: {exc}", exc_info=True
        )
        raise self.retry(exc=exc)
