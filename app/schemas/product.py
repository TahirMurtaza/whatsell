from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    compare_at_price: Optional[float] = None
    sku: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    image_urls: Optional[list[str]] = None
    stock_quantity: int = Field(default=0, ge=0)
    status: str = Field(default="active")
    metadata_: Optional[dict] = Field(None, alias="metadata")


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    compare_at_price: Optional[float] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    image_urls: Optional[list[str]] = None
    stock_quantity: Optional[int] = None
    status: Optional[str] = None
    metadata_: Optional[dict] = Field(None, alias="metadata")


class ProductResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float
    compare_at_price: Optional[float]
    sku: Optional[str]
    category: Optional[str]
    tags: Optional[list[str]]
    image_urls: Optional[list[str]]
    stock_quantity: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
