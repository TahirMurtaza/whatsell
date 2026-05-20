"""
Webhook endpoints:
  POST /webhooks/whatsapp    — WASenderAPI incoming messages
  GET  /webhooks/whatsapp    — WASenderAPI webhook verification challenge
  POST /webhooks/payment/callback — payment gateway callback
"""

import json
import logging

from fastapi import APIRouter, HTTPException, Request, Response

from app.config import get_settings
from app.services.chat_service import chat_service
from app.services.whatsapp_service import (
    parse_incoming_message,
    send_whatsapp_message,
    verify_signature,
)

router = APIRouter()
settings = get_settings()
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# WASenderAPI — webhook verification (GET)
# ---------------------------------------------------------------------------

@router.get("/whatsapp")
async def whatsapp_verify(request: Request):
    challenge = request.query_params.get("challenge", "")
    if challenge:
        logger.info(f"[WASender] Webhook verification challenge: {challenge}")
        return Response(content=challenge, media_type="text/plain")
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# WASenderAPI — incoming messages (POST)
# ---------------------------------------------------------------------------

@router.post("/whatsapp")
async def whatsapp_webhook(request: Request):
    raw_body = await request.body()

    signature = request.headers.get("X-Webhook-Signature", "")
    if not verify_signature(raw_body, signature):
        logger.warning("[WASender] Invalid webhook signature — rejected.")
        raise HTTPException(status_code=401, detail="Invalid signature")

    try:
        body = json.loads(raw_body)
    except Exception:
        return {"status": "ignored"}

    parsed = parse_incoming_message(body)
    if parsed is None:
        return {"status": "ignored"}

    phone, text = parsed
    logger.info(f"[WASender] ← Incoming from {phone}: {text[:80]}")

    session_id = f"wa_{phone}"
    result = await chat_service.process_message(
        session_id=session_id,
        user_message=text,
        customer_phone=phone,
        source="whatsapp",
    )

    await send_whatsapp_message(phone, result["content"])
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Payment callback
# ---------------------------------------------------------------------------

@router.post("/payment/callback")
async def payment_callback(request: Request):
    body = await request.json()
    order_number = body.get("order_number", "")
    payment_status = body.get("status", "")

    if not order_number:
        raise HTTPException(status_code=400, detail="Missing order_number")

    from app.db.postgres import async_session
    from app.services.order_service import get_order_by_number, update_order
    from app.schemas.order import OrderUpdate

    async with async_session() as db:
        order = await get_order_by_number(db, order_number)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        await update_order(db, order.id, OrderUpdate(payment_status=payment_status))
        await db.commit()

    if payment_status == "paid":
        from app.tasks.followups import order_status_update
        order_status_update.delay(
            customer_phone=order.customer.phone if order.customer else "",
            order_number=order_number,
            status="confirmed",
        )

    return {"status": "updated"}
