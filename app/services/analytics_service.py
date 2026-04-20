from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.postgres import Order, Customer, Product
from datetime import datetime, timedelta
from typing import Dict, Any


async def get_dashboard_stats(db: AsyncSession) -> Dict[str, Any]:
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    total_customers = (await db.execute(select(func.count(Customer.id)))).scalar() or 0
    total_products = (await db.execute(select(func.count(Product.id)))).scalar() or 0

    revenue_result = await db.execute(
        select(func.sum(Order.total)).where(Order.payment_status == "paid")
    )
    total_revenue = revenue_result.scalar() or 0.0

    today = datetime.utcnow().date()
    orders_today = (
        await db.execute(
            select(func.count(Order.id)).where(func.date(Order.created_at) == today)
        )
    ).scalar() or 0

    revenue_today_result = await db.execute(
        select(func.sum(Order.total)).where(
            Order.payment_status == "paid",
            func.date(Order.created_at) == today,
        )
    )
    revenue_today = revenue_today_result.scalar() or 0.0

    return {
        "total_orders": total_orders,
        "total_customers": total_customers,
        "total_products": total_products,
        "total_revenue": round(total_revenue, 2),
        "orders_today": orders_today,
        "revenue_today": round(revenue_today, 2),
    }


async def get_order_analytics(db: AsyncSession, days: int = 30) -> Dict[str, Any]:
    since = datetime.utcnow() - timedelta(days=days)

    status_counts = {}
    status_result = await db.execute(
        select(Order.status, func.count(Order.id))
        .where(Order.created_at >= since)
        .group_by(Order.status)
    )
    for status, count in status_result.all():
        status_counts[status] = count

    payment_counts = {}
    payment_result = await db.execute(
        select(Order.payment_status, func.count(Order.id))
        .where(Order.created_at >= since)
        .group_by(Order.payment_status)
    )
    for status, count in payment_result.all():
        payment_counts[status] = count

    avg_order_value_result = await db.execute(
        select(func.avg(Order.total)).where(Order.created_at >= since)
    )
    avg_order_value = avg_order_value_result.scalar() or 0.0

    return {
        "period_days": days,
        "orders_by_status": status_counts,
        "orders_by_payment": payment_counts,
        "avg_order_value": round(avg_order_value, 2),
        "total_orders": sum(status_counts.values()),
    }


async def get_top_products(db: AsyncSession, limit: int = 10) -> list:
    from sqlalchemy import JSON, cast, type_coerce

    result = await db.execute(
        select(
            Order.items,
            func.count(Order.id).label("order_count"),
        )
        .where(Order.status != "cancelled")
        .group_by(Order.items)
        .order_by(func.count(Order.id).desc())
        .limit(limit)
    )
    return [dict(row._mapping) for row in result.all()]


async def get_conversion_rate(db: AsyncSession, days: int = 30) -> Dict[str, Any]:
    since = datetime.utcnow() - timedelta(days=days)

    total_conversations = 0
    from app.db.mongodb import db as mongo_db

    cursor = mongo_db.conversations.find({"created_at": {"$gte": since}})
    total_conversations = await cursor.to_list(length=100000)
    total_conversations = len(total_conversations)

    total_orders_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.created_at >= since,
            Order.source == "chatbot",
        )
    )
    total_orders = total_orders_result.scalar() or 0

    rate = (
        (total_orders / total_conversations * 100) if total_conversations > 0 else 0.0
    )

    return {
        "period_days": days,
        "total_conversations": total_conversations,
        "total_orders": total_orders,
        "conversion_rate": round(rate, 2),
    }
