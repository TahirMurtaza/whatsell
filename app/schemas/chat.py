from pydantic import BaseModel, Field
from typing import Optional


class ChatMessage(BaseModel):
    customer_phone: str
    message: str
    session_id: Optional[str] = None
    source: str = Field(default="whatsapp")
    kb_session_id: Optional[str] = None  # knowledge-base session to search against


class ChatResponse(BaseModel):
    reply: str
    session_id: str
    state: str
    context: dict


class CartItem(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: int = Field(..., gt=0)


class CartUpdate(BaseModel):
    action: str = Field(..., pattern="^(add|remove|update|clear)$")
    product_id: Optional[int] = None
    quantity: Optional[int] = None
