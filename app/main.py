from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.models.mongodb import init_mongo_indexes
from app.services.chat_service import chat_service
from app.middleware.request_logging import RequestLoggingMiddleware
from app.middleware.error_handler import ErrorHandlerMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_mongo_indexes()
    await chat_service.initialize()
    yield


app = FastAPI(
    title=settings.app_name,
    description="E-Commerce AI Chatbot - Product queries, recommendations, order capture, and automated follow-ups",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(ErrorHandlerMiddleware)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name}


from app.api import router as api_router

app.include_router(api_router, prefix=settings.api_prefix)
