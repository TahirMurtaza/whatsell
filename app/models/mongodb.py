from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from app.db.mongodb import db


async def init_mongo_indexes():
    await db.conversations.create_index([("customer_phone", 1), ("created_at", -1)])
    await db.conversations.create_index([("session_id", 1)])
    await db.messages.create_index([("conversation_id", 1), ("timestamp", 1)])
    await db.messages.create_index([("customer_phone", 1)])


async def create_conversation(
    customer_phone: str, session_id: str, source: str = "whatsapp"
) -> dict:
    conversation = {
        "customer_phone": customer_phone,
        "session_id": session_id,
        "source": source,
        "state": "greeting",
        "context": {},
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.conversations.insert_one(conversation)
    conversation["_id"] = str(result.inserted_id)
    return conversation


async def get_conversation_by_session(session_id: str) -> dict | None:
    return await db.conversations.find_one({"session_id": session_id})


async def get_conversation_by_phone(phone: str) -> dict | None:
    return await db.conversations.find_one(
        {"customer_phone": phone}, sort=[("created_at", -1)]
    )


async def update_conversation_state(
    conversation_id: str, state: str, context: dict | None = None
):
    update_data = {"state": state, "updated_at": datetime.utcnow()}
    if context:
        update_data["context"] = context
    await db.conversations.update_one({"_id": conversation_id}, {"$set": update_data})


async def add_message(
    conversation_id: str, role: str, content: str, metadata: dict | None = None
) -> dict:
    now = datetime.utcnow()
    message = {
        "conversation_id": conversation_id,
        "role": role,
        "content": content,
        "metadata": metadata or {},
        "timestamp": now,
    }
    await db.messages.insert_one(message)
    # Keep the conversation's updated_at current so time-range filters work
    try:
        from bson import ObjectId
        await db.conversations.update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"updated_at": now}},
        )
    except Exception:
        pass  # Non-critical — don't break message saves
    return message


async def get_conversation_messages(conversation_id: str, limit: int = 50) -> list:
    cursor = (
        db.messages.find({"conversation_id": conversation_id})
        .sort("timestamp", -1)
        .limit(limit)
    )
    messages = await cursor.to_list(length=limit)
    return list(reversed(messages))
