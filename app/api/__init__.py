from app.api.health import router as health_router
from app.api.webhooks import router as webhooks_router
from app.api.products import router as products_router
from app.api.orders import router as orders_router
from app.api.customers import router as customers_router
from app.api.chat import router as chat_router
from app.api.analytics import router as analytics_router

from fastapi import APIRouter

router = APIRouter()

router.include_router(health_router, prefix="/health", tags=["health"])
router.include_router(webhooks_router, prefix="/webhooks", tags=["webhooks"])
router.include_router(products_router, prefix="/products", tags=["products"])
router.include_router(orders_router, prefix="/orders", tags=["orders"])
router.include_router(customers_router, prefix="/customers", tags=["customers"])
router.include_router(chat_router, prefix="/chat", tags=["chat"])
router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
