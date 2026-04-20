from collections.abc import AsyncGenerator
from app.db.postgres import async_session
from app.db.mongodb import db
from app.db.redis import redis


async def get_db() -> AsyncGenerator:
    async with async_session() as session:
        yield session


async def get_mongo():
    return db


async def get_redis_client():
    return redis
