from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class OrderItem(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: int = Field(..., gt=0)


class OrderCreate(BaseModel):
    customer_phone: str
    items: list[OrderItem]
    shipping_address: Optional[dict] = None
    notes: Optional[str] = None


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    payment_status: Optional[str] = None
    shipping_address: Optional[dict] = None
    notes: Optional[str] = None


class OrderResponse(BaseModel):
    id: int
    order_number: str
    customer_id: int
    items: list[dict]
    subtotal: float
    tax: float
    shipping: float
    total: float
    status: str
    payment_status: str
    payment_link: Optional[str]
    shipping_address: Optional[dict]
    notes: Optional[str]
    source: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
