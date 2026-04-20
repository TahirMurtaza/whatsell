import logging
import asyncio
from typing import Any, Dict, List, Optional
import google.generativeai as genai
from sqlalchemy import select

from app.config import get_settings
from app.db.postgres import async_session
from app.models.postgres import Product

logger = logging.getLogger(__name__)

settings = get_settings()


class VectorService:
    """Semantic product search using Google Gemini embeddings + pgvector"""

    def __init__(self):
        genai.configure(api_key=settings.gemini_api_key)
        self.initialized = True  # Setup complete on instantiation

    async def initialize(self):
        """No-op. pgvector stores embeddings natively in Postgres."""
        pass

    async def _embed_text(self, text: str) -> List[float]:
        """Get embedding for a single query text"""
        result = await asyncio.to_thread(
            genai.embed_content,
            model="models/gemini-embedding-001",
            content=text,
            task_type="retrieval_query",
        )
        return result["embedding"]
        
    async def _embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Get embeddings for a list of texts (used for batching)"""
        if not texts:
            return []
        result = await asyncio.to_thread(
            genai.embed_content,
            model="models/gemini-embedding-001",
            content=texts,
            task_type="retrieval_document",
        )
        return result["embedding"]

    async def search_similar_products(
        self, query: str, top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Search products by semantic similarity using pgvector"""
        try:
            # 1. Embed the search query
            query_embedding = await self._embed_text(query)
            
            # 2. Query Postgres using Cosine Distance
            async with async_session() as db:
                stmt = (
                    select(Product)
                    .filter(Product.embedding.is_not(None))
                    .order_by(Product.embedding.cosine_distance(query_embedding))
                    .limit(top_k)
                )
                
                # We need the product and the distance score.
                # SQLAlchemy allows selecting the distance function directly.
                stmt_with_distance = (
                    select(Product, Product.embedding.cosine_distance(query_embedding).label("distance"))
                    .filter(Product.embedding.is_not(None))
                    .order_by("distance")
                    .limit(top_k)
                )
                
                results_cursor = await db.execute(stmt_with_distance)
                
                results = []
                for row in results_cursor:
                    product = row.Product
                    distance = float(row.distance)
                    
                    # pgvector cosine_distance returns (1 - cosine_similarity), so 0 is perfect match.
                    # We invert it so higher is better, to match standard search expectations.
                    score = 1.0 - distance
                    
                    results.append(
                        {
                            "id": product.id,
                            "name": product.name,
                            "price": product.price,
                            "category": product.category,
                            "description": product.description,
                            "score": score,
                        }
                    )
                    
            return results
            
        except Exception as e:
            logger.error(f"Error searching similar products: {e}")
            return []

    async def refresh_index(self):
        """No-op for pgvector."""
        pass

vector_service = VectorService()
