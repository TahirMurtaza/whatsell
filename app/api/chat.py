import uuid
from fastapi import APIRouter, Depends, HTTPException
from app.services.chat_service import chat_service
from app.schemas.chat import ChatMessage, ChatResponse, CartUpdate, CartItem
from app.db.redis import redis
import json

router = APIRouter()


@router.post("/", response_model=ChatResponse)
async def send_message(payload: ChatMessage):
    session_id = payload.session_id or f"sess_{uuid.uuid4().hex[:12]}"
    result = await chat_service.process_message(
        session_id=session_id,
        user_message=payload.message,
        customer_phone=payload.customer_phone,
        source=payload.source,
        kb_session_id=payload.kb_session_id,
    )
    return ChatResponse(
        reply=result["content"],
        session_id=result["session_id"],
        state=result["state"],
        context={"products": result["products"], "type": result["type"]},
    )


@router.get("/{session_id}/history")
async def get_history(session_id: str, limit: int = 50):
    return await chat_service.get_chat_history(session_id, limit)


@router.get("/{session_id}/cart")
async def get_cart(session_id: str):
    return await chat_service.cart_service.get_cart(session_id)


@router.post("/{session_id}/cart")
async def update_cart(session_id: str, payload: CartUpdate):
    if payload.action == "clear":
        await chat_service.cart_service.clear_cart(session_id)
        return {"message": "Cart cleared"}

    if not payload.product_id:
        raise HTTPException(status_code=400, detail="product_id required")

    from app.services.product_service import get_product
    from app.db.postgres import async_session

    async with async_session() as db:
        product = await get_product(db, payload.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.action == "add":
        cart = await chat_service.cart_service.add_to_cart(
            session_id, product.id, product.name, product.price, payload.quantity or 1
        )
    elif payload.action == "remove":
        cart = await chat_service.cart_service.remove_from_cart(
            session_id, payload.product_id
        )
    elif payload.action == "update":
        cart = await chat_service.cart_service.update_quantity(
            session_id, payload.product_id, payload.quantity or 1
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

    return cart
