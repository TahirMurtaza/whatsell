import json
import logging
from typing import Any, Dict, List, Optional

import redis.asyncio as aioredis
from app.db.redis import redis

logger = logging.getLogger(__name__)


class CartService:
    """Session-based cart service backed by Redis"""

    TTL_SECONDS = 86400  # 24 hours

    def _cart_key(self, session_id: str) -> str:
        return f"cart:{session_id}"

    async def get_cart(self, session_id: str) -> Dict[str, Any]:
        data = await redis.get(self._cart_key(session_id))
        if not data:
            return {"items": [], "subtotal": 0.0, "total_items": 0}
        return json.loads(data)

    async def add_to_cart(
        self,
        session_id: str,
        product_id: int,
        name: str,
        price: float,
        quantity: int = 1,
    ) -> Dict[str, Any]:
        cart = await self.get_cart(session_id)

        for item in cart["items"]:
            if item["product_id"] == product_id:
                item["quantity"] += quantity
                break
        else:
            cart["items"].append(
                {
                    "product_id": product_id,
                    "name": name,
                    "price": price,
                    "quantity": quantity,
                }
            )

        cart["subtotal"] = round(
            sum(i["price"] * i["quantity"] for i in cart["items"]), 2
        )
        cart["total_items"] = sum(i["quantity"] for i in cart["items"])

        await redis.set(
            self._cart_key(session_id), json.dumps(cart), ex=self.TTL_SECONDS
        )
        logger.info(f"Added {quantity}x {name} (id={product_id}) to cart {session_id}")
        return cart

    async def remove_from_cart(
        self, session_id: str, product_id: int
    ) -> Dict[str, Any]:
        cart = await self.get_cart(session_id)
        cart["items"] = [i for i in cart["items"] if i["product_id"] != product_id]
        cart["subtotal"] = round(
            sum(i["price"] * i["quantity"] for i in cart["items"]), 2
        )
        cart["total_items"] = sum(i["quantity"] for i in cart["items"])
        await redis.set(
            self._cart_key(session_id), json.dumps(cart), ex=self.TTL_SECONDS
        )
        return cart

    async def update_quantity(
        self, session_id: str, product_id: int, quantity: int
    ) -> Dict[str, Any]:
        cart = await self.get_cart(session_id)
        for item in cart["items"]:
            if item["product_id"] == product_id:
                if quantity <= 0:
                    cart["items"].remove(item)
                else:
                    item["quantity"] = quantity
                break
        cart["subtotal"] = round(
            sum(i["price"] * i["quantity"] for i in cart["items"]), 2
        )
        cart["total_items"] = sum(i["quantity"] for i in cart["items"])
        await redis.set(
            self._cart_key(session_id), json.dumps(cart), ex=self.TTL_SECONDS
        )
        return cart

    async def clear_cart(self, session_id: str) -> None:
        await redis.delete(self._cart_key(session_id))

    async def get_cart_summary(self, session_id: str) -> str:
        cart = await self.get_cart(session_id)
        if not cart["items"]:
            return "Your cart is empty."
        lines = ["Your cart:"]
        for item in cart["items"]:
            lines.append(
                f"  - {item['name']} x{item['quantity']} — ${item['price'] * item['quantity']:.2f}"
            )
        lines.append(f"Subtotal: ${cart['subtotal']:.2f}")
        return "\n".join(lines)
