from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.postgres import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate
from typing import Optional


async def get_or_create_customer(db: AsyncSession, phone: str) -> Customer:
    result = await db.execute(select(Customer).where(Customer.phone == phone))
    customer = result.scalar_one_or_none()
    if not customer:
        customer = Customer(phone=phone)
        db.add(customer)
        await db.commit()
        await db.refresh(customer)
    return customer


async def get_customers(
    db: AsyncSession, skip: int = 0, limit: int = 50
) -> list[Customer]:
    result = await db.execute(
        select(Customer).offset(skip).limit(limit).order_by(Customer.created_at.desc())
    )
    return list(result.scalars().all())


async def get_customer(db: AsyncSession, customer_id: int) -> Optional[Customer]:
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    return result.scalar_one_or_none()


async def get_customer_by_phone(db: AsyncSession, phone: str) -> Optional[Customer]:
    result = await db.execute(select(Customer).where(Customer.phone == phone))
    return result.scalar_one_or_none()


async def update_customer(
    db: AsyncSession, customer_id: int, customer: CustomerUpdate
) -> Optional[Customer]:
    db_customer = await get_customer(db, customer_id)
    if not db_customer:
        return None

    update_data = customer.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_customer, key, value)

    await db.commit()
    await db.refresh(db_customer)
    return db_customer
