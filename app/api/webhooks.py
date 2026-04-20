import uuid
from fastapi import APIRouter, Request, HTTPException
from app.config import get_settings
from app.services.chat_service import chat_service
from app.services.order_service import get_order_by_number
from app.db.postgres import async_session

router = APIRouter()
settings = get_settings()


@router.post("/whatsapp")
async def whatsapp_webhook(request: Request):
    body = await request.json()

    entry = body.get("entry", [])
    for entry_item in entry:
        changes = entry_item.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            messages = value.get("messages", [])
            for msg in messages:
                if msg.get("type") == "text":
                    phone = value.get("metadata", {}).get("phone_number_id", "")
                    customer_phone = msg.get("from", "")
                    text = msg.get("text", {}).get("body", "")
                    session_id = f"wa_{customer_phone}"

                    result = await chat_service.process_message(
                        session_id=session_id,
                        user_message=text,
                        customer_phone=customer_phone,
                        source="whatsapp",
                    )
                    await _send_whatsapp_message(customer_phone, result["content"])

    return {"status": "received"}


@router.get("/whatsapp")
async def whatsapp_verify(
    hub_mode: str = "", hub_challenge: str = "", hub_verify_token: str = ""
):
    if hub_verify_token == settings.whatsapp_verify_token:
        return int(hub_challenge)
    raise HTTPException(status_code=403, detail="Invalid verify token")


@router.post("/payment/callback")
async def payment_callback(request: Request):
    body = await request.json()
    order_number = body.get("order_number", "")
    payment_status = body.get("status", "")

    if not order_number:
        raise HTTPException(status_code=400, detail="Missing order_number")

    async with async_session() as db:
        order = await get_order_by_number(db, order_number)
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        from app.services.order_service import update_order
        from app.schemas.order import OrderUpdate

        await update_order(db, order.id, OrderUpdate(payment_status=payment_status))
        await db.commit()

    if payment_status == "paid":
        from app.tasks.followups import order_status_update

        order_status_update.delay(
            customer_phone="",
            order_number=order_number,
            status="confirmed",
        )

    return {"status": "updated"}


async def _send_whatsapp_message(phone: str, message: str):
    import httpx

    async with httpx.AsyncClient() as client:
        await client.post(
            f"https://graph.facebook.com/v18.0/{settings.whatsapp_access_token}/messages",
            headers={
                "Authorization": f"Bearer {settings.whatsapp_access_token}",
                "Content-Type": "application/json",
            },
            json={
                "messaging_product": "whatsapp",
                "to": phone,
                "type": "text",
                "text": {"body": message},
            },
        )
