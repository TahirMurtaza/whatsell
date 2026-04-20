import json
import logging
from typing import Any, Dict, Optional

import httpx
from app.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class PaymentService:
    """Payment service supporting Stripe and Razorpay"""

    def __init__(self):
        self.provider = "stripe"
        self.stripe_key = ""
        self.razorpay_key = ""
        self.razorpay_secret = ""

    async def create_payment_link(
        self,
        order_number: str,
        amount: float,
        currency: str = "USD",
        customer_phone: str = "",
        customer_email: str = "",
        description: str = "",
    ) -> Dict[str, Any]:
        if self.provider == "stripe":
            return await self._create_stripe_payment(
                order_number, amount, currency, customer_email, description
            )
        return await self._create_razorpay_payment(
            order_number, amount, currency, customer_phone, description
        )

    async def _create_stripe_payment(
        self,
        order_number: str,
        amount: float,
        currency: str,
        customer_email: str,
        description: str,
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.stripe.com/v1/payment_links",
                    headers={
                        "Authorization": f"Bearer {self.stripe_key}",
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    data={
                        "line_items[0][price_data][currency]": currency.lower(),
                        "line_items[0][price_data][unit_amount]": int(amount * 100),
                        "line_items[0][price_data][product_data][name]": f"Order {order_number}",
                        "line_items[0][price_data][product_data][description]": description,
                        "line_items[0][quantity]": 1,
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "payment_link": data.get("url", ""),
                        "provider": "stripe",
                    }
                return {"success": False, "error": response.text}
        except Exception as e:
            logger.error(f"Stripe payment creation error: {e}")
            return {"success": False, "error": str(e)}

    async def _create_razorpay_payment(
        self,
        order_number: str,
        amount: float,
        currency: str,
        customer_phone: str,
        description: str,
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.razorpay.com/v1/payment_links",
                    auth=(self.razorpay_key, self.razorpay_secret),
                    json={
                        "amount": int(amount * 100),
                        "currency": currency.upper(),
                        "accept_partial": False,
                        "description": f"Order {order_number}",
                        "customer": {
                            "name": "",
                            "contact": customer_phone,
                        },
                        "notify": {
                            "sms": True,
                            "email": False,
                        },
                        "reminder_enable": True,
                        "notes": {"order_number": order_number},
                    },
                )
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "payment_link": data.get("short_url", ""),
                        "provider": "razorpay",
                    }
                return {"success": False, "error": response.text}
        except Exception as e:
            logger.error(f"Razorpay payment creation error: {e}")
            return {"success": False, "error": str(e)}

    async def create_mock_payment_link(self, order_number: str, amount: float) -> str:
        return f"https://pay.whatsell.dev/mock/{order_number}?amount={amount}"


payment_service = PaymentService()
