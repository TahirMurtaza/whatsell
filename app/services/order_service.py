import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.postgres import Order, Customer
from app.schemas.order import OrderCreate, OrderUpdate
from app.services.customer_service import get_or_create_customer
from typing import Optional


def generate_order_number() -> str:
    return f"WS-{uuid.uuid4().hex[:8].upper()}"


async def create_order(db: AsyncSession, order_data: OrderCreate) -> Order:
    customer = await get_or_create_customer(db, order_data.customer_phone)

    items = [item.model_dump() for item in order_data.items]
    subtotal = sum(item.price * item.quantity for item in order_data.items)
    tax = round(subtotal * 0.1, 2)
    shipping = 0.0 if subtotal > 50 else 5.99
    total = round(subtotal + tax + shipping, 2)

    db_order = Order(
        order_number=generate_order_number(),
        customer_id=customer.id,
        items=items,
        subtotal=subtotal,
        tax=tax,
        shipping=shipping,
        total=total,
        shipping_address=order_data.shipping_address,
        notes=order_data.notes,
    )
    db.add(db_order)
    await db.commit()
    await db.refresh(db_order)
    return db_order


async def get_orders(db: AsyncSession, skip: int = 0, limit: int = 50) -> list[Order]:
    result = await db.execute(
        select(Order).offset(skip).limit(limit).order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


async def get_order(db: AsyncSession, order_id: int) -> Optional[Order]:
    result = await db.execute(select(Order).where(Order.id == order_id))
    return result.scalar_one_or_none()


async def get_order_by_number(db: AsyncSession, order_number: str) -> Optional[Order]:
    result = await db.execute(select(Order).where(Order.order_number == order_number))
    return result.scalar_one_or_none()


async def get_customer_orders(db: AsyncSession, customer_id: int) -> list[Order]:
    result = await db.execute(
        select(Order)
        .where(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc())
    )
    return list(result.scalars().all())


async def update_order(
    db: AsyncSession, order_id: int, order: OrderUpdate
) -> Optional[Order]:
    db_order = await get_order(db, order_id)
    if not db_order:
        return None

    update_data = order.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_order, key, value)

    await db.commit()
    await db.refresh(db_order)
    return db_order
