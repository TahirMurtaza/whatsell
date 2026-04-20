from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db
from app.services import analytics_service

router = APIRouter()


@router.get("/dashboard")
async def dashboard(db: AsyncSession = Depends(get_db)):
    return await analytics_service.get_dashboard_stats(db)


@router.get("/orders")
async def order_analytics(
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    return await analytics_service.get_order_analytics(db, days=days)


@router.get("/conversion")
async def conversion_rate(
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
):
    return await analytics_service.get_conversion_rate(db, days=days)


@router.get("/top-products")
async def top_products(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(10, ge=1, le=50),
):
    return await analytics_service.get_top_products(db, limit=limit)
