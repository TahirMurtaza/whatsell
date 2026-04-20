from app.tasks.celery import celery_app
from datetime import datetime


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_followup_message(
    self, customer_phone: str, message: str, channel: str = "whatsapp"
):
    try:
        print(f"Sending followup to {customer_phone} via {channel}: {message}")
        return {"status": "sent", "phone": customer_phone}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=300)
def abandoned_cart_reminder(self, customer_phone: str, cart_items: list):
    try:
        items_str = ", ".join([item.get("name", "item") for item in cart_items])
        message = f"Hey! You left {items_str} in your cart. Complete your order now!"
        print(f"Abandoned cart reminder to {customer_phone}: {message}")
        return {"status": "sent", "phone": customer_phone}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def order_status_update(self, customer_phone: str, order_number: str, status: str):
    try:
        message = f"Your order {order_number} is now {status}."
        print(f"Order update to {customer_phone}: {message}")
        return {"status": "sent", "phone": customer_phone}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=120)
def delivery_reminder(self, customer_phone: str, order_number: str):
    try:
        message = f"Your order {order_number} is out for delivery today!"
        print(f"Delivery reminder to {customer_phone}: {message}")
        return {"status": "sent", "phone": customer_phone}
    except Exception as exc:
        raise self.retry(exc=exc)


@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def review_request(self, customer_phone: str, order_number: str):
    try:
        message = f"Thanks for your order {order_number}! How was your experience? Reply with a rating 1-5."
        print(f"Review request to {customer_phone}: {message}")
        return {"status": "sent", "phone": customer_phone}
    except Exception as exc:
        raise self.retry(exc=exc)


def schedule_followup(task, eta_minutes: int, **kwargs):
    from datetime import timedelta

    task.apply_async(kwargs=kwargs, countdown=eta_minutes * 60)
