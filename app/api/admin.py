"""
Admin dashboard API endpoints.

GET /admin/sessions              — paginated list of all chat sessions
GET /admin/sessions/{session_id} — full detail: messages + tool calls + tokens + stats
GET /admin/analytics             — combined ecommerce + conversation analytics
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.db.mongodb import db as mongo_db
from app.db.postgres import async_session
from app.models.mongodb import get_conversation_by_session, get_conversation_messages
from app.services.analytics_service import (
    get_dashboard_stats,
    get_order_analytics,
    get_top_products,
)

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# GET /admin/sessions
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Filter by customer_phone substring"),
):
    """Return a paginated list of all chat sessions with message counts."""
    match_stage: dict = {}
    if search:
        match_stage["customer_phone"] = {"$regex": search, "$options": "i"}

    pipeline = [
        {"$match": match_stage},
        {"$sort": {"updated_at": -1}},
        {
            "$lookup": {
                "from": "messages",
                "let": {"conv_id": {"$toString": "$_id"}},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$conversation_id", "$$conv_id"]}}},
                    {"$count": "n"},
                ],
                "as": "_msg_count",
            }
        },
        {
            "$addFields": {
                "message_count": {
                    "$ifNull": [{"$arrayElemAt": ["$_msg_count.n", 0]}, 0]
                }
            }
        },
        {"$project": {"_msg_count": 0}},
        {"$facet": {
            "data": [{"$skip": skip}, {"$limit": limit}],
            "total": [{"$count": "n"}],
        }},
    ]

    result = await mongo_db.conversations.aggregate(pipeline).to_list(length=1)
    data = result[0]["data"] if result else []
    total = result[0]["total"][0]["n"] if result and result[0]["total"] else 0

    sessions = []
    for conv in data:
        sessions.append({
            "session_id": conv.get("session_id", ""),
            "customer_phone": conv.get("customer_phone", ""),
            "source": conv.get("source", ""),
            "state": conv.get("state", ""),
            "message_count": conv.get("message_count", 0),
            "created_at": conv.get("created_at", "").isoformat() if conv.get("created_at") else None,
            "updated_at": conv.get("updated_at", "").isoformat() if conv.get("updated_at") else None,
        })

    return {"sessions": sessions, "total": total, "skip": skip, "limit": limit}


# ---------------------------------------------------------------------------
# GET /admin/sessions/{session_id}
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}")
async def get_session_detail(session_id: str):
    """Full session detail: conversation metadata, all messages, and aggregate stats."""
    conv = await get_conversation_by_session(session_id)
    if not conv:
        return JSONResponse(status_code=404, content={"detail": "Session not found"})

    conv_id = str(conv["_id"])
    raw_messages = await get_conversation_messages(conv_id, limit=500)

    messages = []
    for m in raw_messages:
        meta = m.get("metadata") or {}
        # Construct trace_url server-side if trace_id present but url missing
        messages.append({
            "id": str(m["_id"]),
            "role": m.get("role", ""),
            "content": m.get("content", ""),
            "timestamp": m["timestamp"].isoformat() if m.get("timestamp") else None,
            "metadata": meta,
        })

    # --- Compute session stats ---
    total_prompt = 0
    total_completion = 0
    total_tokens = 0
    response_times_ms = []

    # Pair user → assistant messages for latency calculation
    prev_user_ts: Optional[datetime] = None

    for m in raw_messages:
        if m.get("role") == "user":
            prev_user_ts = m.get("timestamp")
        elif m.get("role") == "assistant":
            if prev_user_ts and m.get("timestamp"):
                delta = (m["timestamp"] - prev_user_ts).total_seconds() * 1000
                if 0 < delta < 300_000:   # ignore outliers > 5 min
                    response_times_ms.append(delta)
            prev_user_ts = None

            tc = (m.get("metadata") or {}).get("token_counts") or {}
            total_prompt += tc.get("prompt_tokens", 0)
            total_completion += tc.get("completion_tokens", 0)
            total_tokens += tc.get("total_tokens", 0)

    avg_response_ms = (
        round(sum(response_times_ms) / len(response_times_ms))
        if response_times_ms else 0
    )
    assistant_count = sum(1 for m in raw_messages if m.get("role") == "assistant")

    return {
        "conversation": {
            "session_id": conv.get("session_id", ""),
            "customer_phone": conv.get("customer_phone", ""),
            "source": conv.get("source", ""),
            "state": conv.get("state", ""),
            "created_at": conv["created_at"].isoformat() if conv.get("created_at") else None,
            "updated_at": conv["updated_at"].isoformat() if conv.get("updated_at") else None,
        },
        "messages": messages,
        "stats": {
            "message_count": len(raw_messages),
            "assistant_message_count": assistant_count,
            "total_prompt_tokens": total_prompt,
            "total_completion_tokens": total_completion,
            "total_tokens": total_tokens,
            "avg_response_time_ms": avg_response_ms,
        },
    }


# ---------------------------------------------------------------------------
# GET /admin/analytics
# ---------------------------------------------------------------------------

@router.get("/analytics")
async def get_analytics():
    """Combined ecommerce stats + conversation metrics."""
    async with async_session() as db:
        ecommerce = await get_dashboard_stats(db)
        orders = await get_order_analytics(db, days=30)
        top_products = await get_top_products(db, limit=5)

    # MongoDB conversation counts
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    total_conversations = await mongo_db.conversations.count_documents({})
    conversations_today = await mongo_db.conversations.count_documents(
        {"created_at": {"$gte": today_start}}
    )
    messages_today = await mongo_db.messages.count_documents(
        {"timestamp": {"$gte": today_start}}
    )

    # Total token usage (sum over all messages that have token_counts)
    token_pipeline = [
        {"$match": {"metadata.token_counts.total_tokens": {"$exists": True, "$gt": 0}}},
        {"$group": {
            "_id": None,
            "total_tokens": {"$sum": "$metadata.token_counts.total_tokens"},
            "total_prompt": {"$sum": "$metadata.token_counts.prompt_tokens"},
            "total_completion": {"$sum": "$metadata.token_counts.completion_tokens"},
        }},
    ]
    token_agg = await mongo_db.messages.aggregate(token_pipeline).to_list(length=1)
    token_stats = token_agg[0] if token_agg else {
        "total_tokens": 0, "total_prompt": 0, "total_completion": 0
    }

    return {
        "ecommerce": ecommerce,
        "orders": orders,
        "top_products": top_products,
        "conversations": {
            "total_conversations": total_conversations,
            "conversations_today": conversations_today,
            "messages_today": messages_today,
            "total_tokens_used": token_stats.get("total_tokens", 0),
            "total_prompt_tokens": token_stats.get("total_prompt", 0),
            "total_completion_tokens": token_stats.get("total_completion", 0),
        },
    }
