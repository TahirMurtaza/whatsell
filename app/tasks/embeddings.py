"""
Background Celery task to compute and store product embeddings.
Processes products in batches of 100 to stay within Gemini rate limits.
"""
import asyncio
import logging
from typing import List

import google.generativeai as genai
from celery import shared_task
from sqlalchemy import select, update

from app.config import get_settings
from app.db.postgres import sync_session
from app.models.postgres import Product

logger = logging.getLogger(__name__)

settings = get_settings()


def _embed_texts_sync(texts: List[str]) -> List[List[float]]:
    """Synchronously call Gemini embed API (used inside Celery worker)."""
    genai.configure(api_key=settings.gemini_api_key)
    result = genai.embed_content(
        model="models/gemini-embedding-001",
        content=texts,
        task_type="retrieval_document",
    )
    return result["embedding"]


@shared_task(
    bind=True,
    name="app.tasks.embeddings.embed_missing_products",
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=600,
)
def embed_missing_products(self, batch_size: int = 100):
    """
    Celery task: Find products with no embedding and compute them in batches.
    Designed to be called periodically via Celery Beat.
    """
    try:
        with sync_session() as db:
            # Fetch a batch of products that don't have an embedding yet
            stmt = (
                select(Product)
                .filter(Product.embedding.is_(None))
                .filter(Product.status == "active")
                .limit(batch_size)
            )
            result = db.execute(stmt)
            products = result.scalars().all()

            if not products:
                logger.info("No products missing embeddings. All up to date!")
                return {"status": "done", "processed": 0}

            # Build text strings for each product
            texts = [
                f"{p.name} {p.description or ''} {p.category or ''} {' '.join(p.tags or [])}"
                for p in products
            ]

            logger.info(f"Generating embeddings for {len(texts)} products...")
            embeddings = _embed_texts_sync(texts)

            # Save each embedding back to its product row
            for product, embedding in zip(products, embeddings):
                product.embedding = embedding

            db.commit()
            logger.info(f"Successfully saved {len(products)} embeddings.")
            return {"status": "ok", "processed": len(products)}

    except Exception as exc:
        logger.error(f"embed_missing_products task failed: {exc}", exc_info=True)
        raise self.retry(exc=exc)
