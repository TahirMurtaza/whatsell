from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.dependencies import get_db
from app.services import customer_service
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter()


@router.get("/", response_model=list[CustomerResponse])
async def list_customers(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    return await customer_service.get_customers(db, skip=skip, limit=limit)


@router.get("/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    customer = await customer_service.get_customer(db, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.post("/", response_model=CustomerResponse, status_code=201)
async def create_customer(customer: CustomerCreate, db: AsyncSession = Depends(get_db)):
    return await customer_service.get_or_create_customer(db, customer.phone)


@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int, customer: CustomerUpdate, db: AsyncSession = Depends(get_db)
):
    updated = await customer_service.update_customer(db, customer_id, customer)
    if not updated:
        raise HTTPException(status_code=404, detail="Customer not found")
    return updated
