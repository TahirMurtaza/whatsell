"""
Celery follow-up tasks — send real WhatsApp messages via WASenderAPI.
"""

import logging

from app.tasks.celery import celery_app

logger = logging.getLogger(__name__)


def _send(phone: str, message: str) -> bool:
    """Helper: synchronously send a WhatsApp message from a Celery worker."""
    from app.services.whatsapp_service import send_whatsapp_message_sync
    return send_whatsapp_message_sync(phone, message)


@celery_app.task(
    bind=True,
    name="app.tasks.followups.send_followup_message",
    max_retries=3,
    default_retry_delay=60,
)
def send_followup_message(self, customer_phone: str, message: str, channel: str = "whatsapp"):
    try:
        logger.info(f"[Followup] Sending to {customer_phone}: {message[:60]}")
        ok = _send(customer_phone, message)
        return {"status": "sent" if ok else "failed", "phone": customer_phone}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="app.tasks.followups.abandoned_cart_reminder",
    max_retries=3,
    default_retry_delay=300,
)
def abandoned_cart_reminder(self, customer_phone: str, cart_items: list):
    try:
        items_str = ", ".join(item.get("name", "item") for item in cart_items[:3])
        if len(cart_items) > 3:
            items_str += f" and {len(cart_items) - 3} more"
        message = (
            f"👋 Hey! You left *{items_str}* in your cart.\n\n"
            f"Complete your order now before they sell out! "
            f"Just reply and I'll help you finish up. 🛍️"
        )
        logger.info(f"[Followup] Abandoned cart reminder → {customer_phone}")
        ok = _send(customer_phone, message)
        return {"status": "sent" if ok else "failed", "phone": customer_phone}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="app.tasks.followups.order_status_update",
    max_retries=3,
    default_retry_delay=60,
)
def order_status_update(self, customer_phone: str, order_number: str, status: str):
    try:
        status_messages = {
            "confirmed": f"✅ Your order *{order_number}* has been confirmed! We'll notify you when it ships.",
            "shipped":   f"📦 Great news! Order *{order_number}* is on its way. You'll receive tracking details shortly.",
            "delivered": f"🎉 Order *{order_number}* has been delivered! Enjoy your purchase.",
            "cancelled": f"❌ Order *{order_number}* has been cancelled. Reply if you have questions.",
        }
        message = status_messages.get(
            status,
            f"Your order *{order_number}* status is now: *{status}*.",
        )
        if customer_phone:
            logger.info(f"[Followup] Order update ({status}) → {customer_phone}")
            ok = _send(customer_phone, message)
            return {"status": "sent" if ok else "failed", "phone": customer_phone}
        return {"status": "skipped", "reason": "no phone"}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="app.tasks.followups.delivery_reminder",
    max_retries=3,
    default_retry_delay=120,
)
def delivery_reminder(self, customer_phone: str, order_number: str):
    try:
        message = (
            f"📦 Your order *{order_number}* is out for delivery today!\n\n"
            f"Make sure someone is available to receive it. "
            f"Reply here if you need to reschedule."
        )
        logger.info(f"[Followup] Delivery reminder → {customer_phone}")
        ok = _send(customer_phone, message)
        return {"status": "sent" if ok else "failed", "phone": customer_phone}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    name="app.tasks.followups.review_request",
    max_retries=3,
    default_retry_delay=60,
)
def review_request(self, customer_phone: str, order_number: str):
    try:
        message = (
            f"⭐ Thanks for your order *{order_number}*!\n\n"
            f"How was your experience? Reply with a rating from 1–5 "
            f"and we'll pass it along to our team. Your feedback means a lot! 🙏"
        )
        logger.info(f"[Followup] Review request → {customer_phone}")
        ok = _send(customer_phone, message)
        return {"status": "sent" if ok else "failed", "phone": customer_phone}
    except Exception as exc:
        raise self.retry(exc=exc)


def schedule_followup(task, eta_minutes: int, **kwargs):
    task.apply_async(kwargs=kwargs, countdown=eta_minutes * 60)
