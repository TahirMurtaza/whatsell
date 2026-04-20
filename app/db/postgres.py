from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

# Async engine for FastAPI
engine = create_async_engine(settings.postgres_url, echo=settings.debug)
async_session = async_sessionmaker(engine, expire_on_commit=False)

# Sync engine for Celery workers
sync_engine = create_engine(settings.postgres_sync_url, pool_pre_ping=True)
sync_session = sessionmaker(sync_engine, expire_on_commit=False)
