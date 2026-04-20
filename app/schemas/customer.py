from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CustomerCreate(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20)
    name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[dict] = None
    preferences: Optional[dict] = None


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[dict] = None
    preferences: Optional[dict] = None


class CustomerResponse(BaseModel):
    id: int
    phone: str
    name: Optional[str]
    email: Optional[str]
    address: Optional[dict]
    preferences: Optional[dict]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
