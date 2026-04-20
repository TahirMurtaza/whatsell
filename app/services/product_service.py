from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.postgres import Product
from app.schemas.product import ProductCreate, ProductUpdate
from typing import Optional


async def get_products(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    search: Optional[str] = None,
) -> tuple[list[Product], int]:
    query = select(Product).where(Product.status == "active")

    if category:
        query = query.where(Product.category == category)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.offset(skip).limit(limit).order_by(Product.created_at.desc())
    result = await db.execute(query)
    products = result.scalars().all()

    return list(products), total


async def get_product(db: AsyncSession, product_id: int) -> Optional[Product]:
    result = await db.execute(select(Product).where(Product.id == product_id))
    return result.scalar_one_or_none()


async def create_product(db: AsyncSession, product: ProductCreate) -> Product:
    db_product = Product(**product.model_dump(by_alias=True))
    db.add(db_product)
    await db.commit()
    await db.refresh(db_product)
    return db_product


async def update_product(
    db: AsyncSession, product_id: int, product: ProductUpdate
) -> Optional[Product]:
    db_product = await get_product(db, product_id)
    if not db_product:
        return None

    update_data = product.model_dump(exclude_unset=True, by_alias=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)

    await db.commit()
    await db.refresh(db_product)
    return db_product


async def delete_product(db: AsyncSession, product_id: int) -> bool:
    db_product = await get_product(db, product_id)
    if not db_product:
        return False
    await db.delete(db_product)
    await db.commit()
    return True
