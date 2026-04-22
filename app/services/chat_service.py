import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from langchain.agents import AgentType, initialize_agent
from langchain.memory import ConversationBufferWindowMemory
from langchain.tools import Tool
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import get_settings
from app.services.cart_service import CartService
from app.services.product_service import get_product, get_products
from app.services.vector_service import VectorService
from app.services.order_service import create_order, get_order_by_number
from app.services.customer_service import get_customer_by_phone
from app.services.payment_service import payment_service
from app.schemas.order import OrderCreate, OrderItem
from app.db.postgres import async_session
from app.models.mongodb import (
    create_conversation,
    get_conversation_by_session,
    update_conversation_state,
    add_message,
    get_conversation_messages,
)

logger = logging.getLogger(__name__)

settings = get_settings()


class ChatService:
    """AI chat service with LangChain + Google Gemini agent + tools"""

    def __init__(self):
        self.llm = None
        self.vector_service = VectorService()
        self.cart_service = CartService()
        self.memory_sessions: Dict[str, ConversationBufferWindowMemory] = {}
        self.initialized = False
        self._main_loop = None  # captured at startup; used by _run_sync

    async def initialize(self):
        """Initialize LangChain components"""
        import asyncio
        try:
            # Capture the running event loop once so _run_sync can always
            # schedule coroutines onto it from worker threads.
            self._main_loop = asyncio.get_running_loop()

            self.llm = ChatGoogleGenerativeAI(
                model=settings.gemini_model,
                google_api_key=settings.gemini_api_key,
                temperature=0.7,
                max_output_tokens=1000,
            )

            await self.vector_service.initialize()
            self.initialized = True
            logger.info("Chat service initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize chat service: {e}")
            raise

    def get_or_create_memory(self, session_id: str) -> ConversationBufferWindowMemory:
        if session_id not in self.memory_sessions:
            self.memory_sessions[session_id] = ConversationBufferWindowMemory(
                k=10,
                return_messages=True,
                memory_key="chat_history",
                output_key="output",  # needed when return_intermediate_steps=True
            )
        return self.memory_sessions[session_id]

    def create_tools(self, session_id: str) -> List[Tool]:
        return [
            Tool(
                name="search_products",
                description="Find products using semantic search. Input: search query (str).",
                func=lambda q: self._run_sync(self._search_products_tool, q),
            ),
            Tool(
                name="filter_products",
                description="Filter products. Input: JSON string with keys: category, min_price, max_price, in_stock_only, search_query, limit.",
                func=lambda q: self._run_sync(self._filter_products_tool, q),
            ),
            Tool(
                name="get_product_details",
                description="Get product details by ID. Input: product ID (int as string).",
                func=lambda q: self._run_sync(self._get_product_details_tool, q),
            ),
            Tool(
                name="get_recommendations",
                description="Get product recommendations. Input: product ID or preference description (str).",
                func=lambda q: self._run_sync(self._get_recommendations_tool, q),
            ),
            Tool(
                name="add_to_cart",
                description="Add a product to cart. Input: JSON with keys: product_id (int), quantity (int, default 1), session_id (str).",
                func=lambda q: self._run_sync(self._add_to_cart_tool, q, session_id),
            ),
            Tool(
                name="view_cart",
                description="View the current cart contents. Input: session_id (str).",
                func=lambda q: self._run_sync(self._view_cart_tool, session_id),
            ),
            Tool(
                name="clear_cart",
                description="Clear the cart. Input: session_id (str).",
                func=lambda q: self._run_sync(self._clear_cart_tool, session_id),
            ),
            Tool(
                name="checkout",
                description="Complete the order from cart. Input: JSON with session_id (str), customer_phone (str), shipping_address (JSON string, optional).",
                func=lambda q: self._run_sync(self._checkout_tool, q, session_id),
            ),
            Tool(
                name="get_order_status",
                description="Check order status by order number. Input: order number (str).",
                func=lambda q: self._run_sync(self._order_status_tool, q),
            ),
        ]

    def _run_sync(self, coro, *args):
        """Run an async tool coroutine from a sync (thread-pool) context.

        LangChain calls tool funcs synchronously, but those funcs are async.
        We must NOT call loop.run_until_complete() on the already-running
        uvicorn loop — that corrupts SQLAlchemy's async connection pool.
        Instead, schedule the coroutine onto the main loop from this thread.
        """
        import asyncio

        if self._main_loop and self._main_loop.is_running():
            # We're in a worker thread; dispatch to the main event loop.
            future = asyncio.run_coroutine_threadsafe(coro(*args), self._main_loop)
            return future.result(timeout=60)

        # Fallback: no main loop captured yet (shouldn't happen in production).
        import asyncio as _asyncio
        loop = _asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro(*args))
        finally:
            loop.close()

    async def _search_products_tool(self, query: str) -> str:
        try:
            similar = await self.vector_service.search_similar_products(query, top_k=6)
            if not similar:
                return json.dumps({"message": "No products found.", "product_ids": []})

            result = "Found the following products:\n"
            for p in similar:
                result += f"- {p['name']} — ${p['price']:.2f} ({p.get('category', 'N/A')})\n"
                desc = (p.get("description") or "")[:120]
                if desc:
                    result += f"  {desc}...\n"

            return json.dumps(
                {
                    "message": result,
                    "product_ids": [p["id"] for p in similar],
                }
            )
        except Exception as e:
            logger.error(f"Error in search_products_tool: {e}")
            return json.dumps({"message": "Error searching products.", "product_ids": []})

    async def _filter_products_tool(self, filter_json: str) -> str:
        try:
            filters = json.loads(filter_json)
            async with async_session() as db:
                products, _ = await get_products(
                    db,
                    category=filters.get("category"),
                    search=filters.get("search_query"),
                    limit=filters.get("limit", 10),
                )

            if not products:
                return json.dumps({"message": "No products found.", "product_ids": []})

            result = f"Found {len(products)} products:\n"
            for p in products[:5]:
                result += f"- {p.name} — ${p.price:.2f}\n"

            return json.dumps(
                {
                    "message": result,
                    "product_ids": [p.id for p in products[:5]],
                }
            )
        except Exception as e:
            logger.error(f"Error in filter_products_tool: {e}")
            return json.dumps({"message": "Error filtering products.", "product_ids": []})

    async def _get_product_details_tool(self, product_id: str) -> str:
        try:
            pid = int(product_id.strip())
            async with async_session() as db:
                product = await get_product(db, pid)
            if not product:
                return "Product not found."

            result = (
                f"Product Details:\n"
                f"Name: {product.name}\n"
                f"Price: ${product.price:.2f}\n"
                f"Category: {product.category or 'N/A'}\n"
                f"Description: {product.description or 'N/A'}\n"
                f"Stock: {product.stock_quantity} available\n"
                f"Tags: {', '.join(product.tags or [])}\n"
            )
            return result
        except Exception as e:
            logger.error(f"Error in get_product_details_tool: {e}")
            return "Error getting product details."

    async def _get_recommendations_tool(self, input_text: str) -> str:
        try:
            # Try as product ID first
            try:
                pid = int(input_text.strip())
                async with async_session() as db:
                    product = await get_product(db, pid)
                if product:
                    search_text = f"{product.name} {product.description or ''} {product.category or ''}"
                    similar = await self.vector_service.search_similar_products(search_text, top_k=4)
                    similar = [p for p in similar if p["id"] != pid]
                else:
                    similar = await self.vector_service.search_similar_products(input_text, top_k=4)
            except ValueError:
                similar = await self.vector_service.search_similar_products(input_text, top_k=4)

            if not similar:
                return "No recommendations found."

            result = "Here are some recommendations:\n"
            for p in similar:
                result += f"- {p['name']} — ${p['price']:.2f}\n"
            return result
        except Exception as e:
            logger.error(f"Error in get_recommendations_tool: {e}")
            return "Error getting recommendations."

    async def _add_to_cart_tool(self, input_json: str, session_id: str) -> str:
        try:
            data = json.loads(input_json)
            product_id = data.get("product_id")
            quantity = data.get("quantity", 1)

            if not product_id:
                return json.dumps({"message": "Missing product_id.", "success": False})

            # If product_id looks like a name, search for it
            if isinstance(product_id, str) and (len(product_id) < 10 or " " in product_id):
                similar = await self.vector_service.search_similar_products(product_id, top_k=1)
                if similar:
                    product_id = similar[0]["id"]
                else:
                    return json.dumps(
                        {
                            "message": f"Product '{product_id}' not found.",
                            "success": False,
                        }
                    )

            async with async_session() as db:
                product = await get_product(db, int(product_id))
                if not product:
                    return json.dumps(
                        {
                            "message": f"Product {product_id} not found.",
                            "success": False,
                        }
                    )

            cart = await self.cart_service.add_to_cart(
                session_id, int(product_id), product.name, product.price, quantity
            )

            return json.dumps(
                {
                    "message": f"Added {quantity}x {product.name} to your cart.",
                    "success": True,
                    "product": {
                        "id": product.id,
                        "name": product.name,
                        "price": product.price,
                    },
                    "quantity": quantity,
                    "cart_total": cart["subtotal"],
                }
            )
        except json.JSONDecodeError:
            return json.dumps({"message": "Invalid JSON format.", "success": False})
        except Exception as e:
            logger.error(f"Error in add_to_cart_tool: {e}")
            return json.dumps({"message": "Error adding to cart.", "success": False})

    async def _view_cart_tool(self, session_id: str) -> str:
        return await self.cart_service.get_cart_summary(session_id)

    async def _clear_cart_tool(self, session_id: str) -> str:
        await self.cart_service.clear_cart(session_id)
        return "Cart cleared."

    async def _checkout_tool(self, input_json: str, session_id: str) -> str:
        try:
            data = json.loads(input_json)
            customer_phone = data.get("customer_phone", "")
            shipping_address = data.get("shipping_address")

            cart = await self.cart_service.get_cart(session_id)
            if not cart["items"]:
                return json.dumps(
                    {
                        "message": "Your cart is empty. Add items before checkout.",
                        "success": False,
                    }
                )

            order_items = [
                OrderItem(
                    product_id=item["product_id"],
                    name=item["name"],
                    price=item["price"],
                    quantity=item["quantity"],
                )
                for item in cart["items"]
            ]

            order_data = OrderCreate(
                customer_phone=customer_phone,
                items=order_items,
                shipping_address=shipping_address,
            )

            async with async_session() as db:
                order = await create_order(db, order_data)
                await db.refresh(order)
                order_id = order.id
                order_number = order.order_number
                total = order.total

            payment = await payment_service.create_mock_payment_link(order_number, total)

            await self.cart_service.clear_cart(session_id)

            return json.dumps(
                {
                    "message": f"Order {order_number} created! Total: ${total:.2f}. Pay here: {payment}",
                    "success": True,
                    "order_number": order_number,
                    "total": total,
                    "payment_link": payment,
                }
            )
        except json.JSONDecodeError:
            return json.dumps({"message": "Invalid JSON format.", "success": False})
        except Exception as e:
            logger.error(f"Error in checkout_tool: {e}")
            return json.dumps({"message": "Error during checkout.", "success": False})

    async def _order_status_tool(self, order_number: str) -> str:
        try:
            async with async_session() as db:
                order = await get_order_by_number(db, order_number.strip())
            if not order:
                return json.dumps({"message": f"Order {order_number} not found.", "success": False})
            return json.dumps(
                {
                    "message": (
                        f"Order {order.order_number}:\n"
                        f"Status: {order.status}\n"
                        f"Payment: {order.payment_status}\n"
                        f"Total: ${order.total:.2f}\n"
                        f"Items: {len(order.items)}\n"
                        f"Date: {order.created_at.strftime('%Y-%m-%d %H:%M')}"
                    ),
                    "success": True,
                    "order": {
                        "order_number": order.order_number,
                        "status": order.status,
                        "payment_status": order.payment_status,
                        "total": order.total,
                    },
                }
            )
        except Exception as e:
            logger.error(f"Error in order_status_tool: {e}")
            return json.dumps({"message": "Error checking order status.", "success": False})

    async def process_message(
        self,
        session_id: str,
        user_message: str,
        customer_phone: str = "",
        source: str = "whatsapp",
    ) -> Dict[str, Any]:
        if not self.initialized:
            await self.initialize()

        try:
            # Get or create conversation in MongoDB
            conversation = await get_conversation_by_session(session_id)
            if not conversation:
                conversation = await create_conversation(customer_phone, session_id, source)

            # Save user message
            await add_message(str(conversation["_id"]), "user", user_message)

            # Build agent
            memory = self.get_or_create_memory(session_id)
            tools = self.create_tools(session_id)

            agent = initialize_agent(
                tools=tools,
                llm=self.llm,
                agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,
                memory=memory,
                verbose=True,
                handle_parsing_errors=True,
                return_intermediate_steps=True,
            )

            system_prompt = """You are a helpful AI shopping assistant for an e-commerce store.
You help customers find products, answer questions, and complete orders.

Guidelines:
- Be friendly, helpful, and concise
- Use tools to search products, get details, and manage the cart
- Always include prices and key details when recommending products
- Ask clarifying questions if the request is unclear
- When user says "add to cart" or "order this", use the add_to_cart tool
- After adding to cart, show cart summary and ask if they want to checkout
- When user says "checkout" or "place order", use the checkout tool with their phone number
- After checkout, share the payment link and confirm the order number

Available tools:
- search_products: Find products by description. Input: search query (str).
- filter_products: Filter by category/price. Input: JSON with category, min_price, max_price, search_query, limit.
- get_product_details: Get details by product ID. Input: product ID (int as string).
- get_recommendations: Get recommendations. Input: product ID or preference description.
- add_to_cart: Add to cart. Input: JSON with product_id (int), quantity (int), session_id (str).
- view_cart: View cart. Input: session_id (str).
- clear_cart: Clear cart. Input: session_id (str).
- checkout: Complete order. Input: JSON with session_id (str), customer_phone (str), shipping_address (optional JSON).
"""

            agent_input = {"input": f"{system_prompt}\n\nUser: {user_message}"}
            result = await agent.acall(agent_input)

            ai_response = result.get("output", "I'm sorry, I couldn't process that.")

            product_ids = []
            logger.info(f"[Chat] intermediate_steps present: {'intermediate_steps' in result}, count: {len(result.get('intermediate_steps', []))}")
            if "intermediate_steps" in result:
                import re
                for step in result["intermediate_steps"]:
                    observation = str(step[1])
                    logger.info(f"[Chat] Scanning Observation: {observation[:200]}...")
                    
                    # Search for arrays of numbers in the observation string
                    # Matches "product_ids": [1, 2, 3] or similar patterns
                    matches = re.finditer(r'"product_ids":\s*\[(.*?)\]', observation)
                    for match in matches:
                        try:
                            # Extract and split the IDs
                            id_list_str = match.group(1)
                            # Handle both comma-separated and space-separated lists just in case
                            ids = [int(i.strip()) for i in id_list_str.split(',') if i.strip().isdigit()]
                            product_ids.extend(ids)
                        except Exception as e:
                            logger.error(f"[Chat] Regex parse error: {e}")

            # Deduplicate and validate
            unique_ids = list(set(product_ids))
            logger.info(f"[Chat] Final unique IDs for query: {unique_ids}")
            
            msg_type = "product" if unique_ids else "text"
            await add_message(str(conversation["_id"]), "assistant", ai_response, {"type": msg_type})

            # Update conversation state
            state = "cart" if "cart" in ai_response.lower() else "browsing"
            await update_conversation_state(str(conversation["_id"]), state)

            # Build product list for response
            products = []
            if unique_ids:
                from sqlalchemy import select
                from app.models.postgres import Product

                async with async_session() as db:
                    stmt = select(Product).where(Product.id.in_(unique_ids))
                    db_result = await db.execute(stmt)
                    db_products = db_result.scalars().all()

                    logger.info(f"[Chat] Bulk fetched {len(db_products)} products from DB")

                    for p in db_products:
                        products.append({
                            "id": p.id,
                            "name": p.name,
                            "price": float(p.price),
                            "compare_at_price": float(p.compare_at_price) if p.compare_at_price else None,
                            "image_urls": p.image_urls,
                            "category": p.category,
                            "description": p.description,
                            "sku": p.sku,
                            "tags": p.tags,
                            "stock_quantity": p.stock_quantity,
                        })

            return {
                "content": ai_response,
                "session_id": session_id,
                "state": state,
                "products": products,
                "type": msg_type,
            }


        except Exception as e:
            logger.error(f"Error processing message: {e}")
            return {
                "content": "I'm sorry, I encountered an error. Please try again.",
                "session_id": session_id,
                "state": "error",
                "products": [],
                "type": "text",
            }

    async def get_chat_history(self, session_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        conversation = await get_conversation_by_session(session_id)
        if not conversation:
            return []
        messages = await get_conversation_messages(str(conversation["_id"]), limit)
        return [
            {
                "role": m["role"],
                "content": m["content"],
                "timestamp": m["timestamp"].isoformat()
                if hasattr(m["timestamp"], "isoformat")
                else str(m["timestamp"]),
                "metadata": m.get("metadata", {}),
            }
            for m in messages
        ]

    def clear_session_memory(self, session_id: str):
        self.memory_sessions.pop(session_id, None)


chat_service = ChatService()
