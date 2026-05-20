import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from langchain.agents import AgentType, initialize_agent
from langchain.callbacks.base import BaseCallbackHandler
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


class TokenCountCallback(BaseCallbackHandler):
    """Accumulates token usage from every LLM call in an agent turn."""

    def __init__(self):
        super().__init__()
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.total_tokens = 0

    def on_llm_end(self, response, **kwargs):
        try:
            # LangChain-Google-GenAI path: generation_info carries usage_metadata
            gen_info = response.generations[0][0].generation_info or {}
            usage = gen_info.get("usage_metadata", {})
            self.prompt_tokens += usage.get("prompt_token_count", 0)
            self.completion_tokens += usage.get("candidates_token_count", 0)
            self.total_tokens += usage.get("total_token_count", 0)
        except Exception:
            pass  # Never break the agent turn for observability issues


def _infer_state(tool_calls: list, ai_response: str) -> str:
    """
    Determine conversation state from tool calls (most reliable) then
    fall back to keyword matching on the assistant response text.

    Priority (highest → lowest):
      ordered   – checkout tool succeeded
      checkout  – checkout tool called but failed, or payment-link language
      cart      – add_to_cart / view_cart / clear_cart used, or cart language
      browsing  – product search / filter used, or product language
      greeting  – only if nothing else matches AND it looks like an intro
    """
    tools_used = {tc["tool"] for tc in tool_calls}
    response_lower = ai_response.lower()

    # 1. Ordered — checkout tool returned success
    if "checkout" in tools_used:
        for tc in tool_calls:
            if tc["tool"] == "checkout":
                try:
                    import json as _json
                    out = _json.loads(tc["output"])
                    if out.get("success"):
                        return "ordered"
                except Exception:
                    pass
        # checkout was called but failed → still mark as checkout attempt
        return "checkout"

    # 2. Checkout — payment-link language in response
    if any(kw in response_lower for kw in ("payment link", "pay here", "place your order", "confirm.*order", "order total")):
        return "checkout"

    # 3. Cart — cart tools used or clear cart language
    if tools_used & {"add_to_cart", "view_cart", "clear_cart"}:
        return "cart"
    if any(kw in response_lower for kw in ("added to cart", "your cart", "in your cart", "ready to checkout", "cart total")):
        return "cart"

    # 4. Browsing — product tools used or product language
    if tools_used & {"search_products", "filter_products", "get_product_details", "get_recommendations"}:
        return "browsing"
    if any(kw in response_lower for kw in ("here are", "found", "product", "price", "available", "recommend")):
        return "browsing"

    # 5. Greeting — short opener with no other signal
    if len(ai_response) < 200 and any(kw in response_lower for kw in ("hello", "hi", "welcome", "help you", "how can i")):
        return "greeting"

    return "browsing"


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

    def create_tools(self, session_id: str, kb_session_id: Optional[str] = None, customer_phone: str = "") -> List[Tool]:
        tools = [
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
                func=lambda q: self._run_sync(self._checkout_tool, q, session_id, customer_phone),
            ),
            Tool(
                name="get_order_status",
                description="Check order status by order number. Input: order number (str).",
                func=lambda q: self._run_sync(self._order_status_tool, q),
            ),
        ]

        # Wire in the knowledge-base tool only when a KB session is available
        if kb_session_id:
            _kb_sid = kb_session_id  # capture for closure
            tools.append(
                Tool(
                    name="search_knowledge_base",
                    description=(
                        "Search the store's knowledge base (uploaded documents such as FAQs, "
                        "manuals, policies, or product guides). Use this when the user asks about "
                        "store policies, product instructions, warranties, shipping rules, or any "
                        "topic that might be covered in uploaded documents. "
                        "Input: plain-English search query (str)."
                    ),
                    func=lambda q: self._run_sync(self._search_kb_tool, q, _kb_sid),
                )
            )

        return tools

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

    async def _checkout_tool(self, input_json: str, session_id: str, session_phone: str = "") -> str:
        try:
            data = json.loads(input_json)
            # Use phone from agent input; fall back to the WhatsApp session phone
            customer_phone = data.get("customer_phone", "").strip() or session_phone
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
                subtotal = order.subtotal
                tax = order.tax
                shipping = order.shipping
                total = order.total

            payment = await payment_service.create_mock_payment_link(order_number, total)

            await self.cart_service.clear_cart(session_id)

            return json.dumps(
                {
                    "message": f"Order {order_number} created! Pay here: {payment}",
                    "success": True,
                    "order_number": order_number,
                    "subtotal": subtotal,
                    "tax": tax,
                    "shipping": shipping,
                    "total": total,
                    "payment_link": payment,
                }
            )
        except json.JSONDecodeError:
            return json.dumps({"message": "Invalid JSON format.", "success": False})
        except Exception as e:
            logger.error(f"Error in checkout_tool: {e}")
            return json.dumps({"message": "Error during checkout.", "success": False})

    async def _search_kb_tool(self, query: str, kb_session_id: str) -> str:
        """Search the knowledge base for relevant chunks and return them as context."""
        try:
            from app.services.kb_service import search_chunks

            chunks = await search_chunks(kb_session_id, query, top_k=4)
            if not chunks:
                return "No relevant information found in the knowledge base for that query."

            parts = []
            for i, chunk in enumerate(chunks, 1):
                parts.append(f"[{chunk['filename']}]\n{chunk['content']}")
            return "\n\n---\n\n".join(parts)
        except Exception as e:
            logger.error(f"Error in search_kb_tool: {e}", exc_info=True)
            return "Error searching knowledge base."

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
        kb_session_id: Optional[str] = None,
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
            tools = self.create_tools(session_id, kb_session_id=kb_session_id, customer_phone=customer_phone)

            agent = initialize_agent(
                tools=tools,
                llm=self.llm,
                agent=AgentType.CONVERSATIONAL_REACT_DESCRIPTION,
                memory=memory,
                verbose=True,
                handle_parsing_errors=True,
                return_intermediate_steps=True,
            )

            kb_tool_line = (
                "- search_knowledge_base: Search uploaded store documents (FAQs, manuals, policies). "
                "Use this for questions about warranties, returns, shipping policies, product instructions, "
                "or anything that might be in a store document. Input: search query (str).\n"
                if kb_session_id else ""
            )

            # Format phone for display (add + prefix)
            display_phone = f"+{customer_phone}" if customer_phone and not customer_phone.startswith("+") else customer_phone
            phone_context = (
                f"\nThe customer's WhatsApp number is {display_phone}. "
                f"When they want to checkout, confirm by saying: "
                f"\"I'll place the order using your WhatsApp number {display_phone} — is that correct?\" "
                f"If they confirm, use {display_phone} as customer_phone in the checkout tool. "
                f"If they say no or give a different number, use the number they provide."
                if customer_phone else
                "\nNo phone number is known yet. When checkout is requested, ask the customer for their phone number first."
            )

            system_prompt = f"""You are a friendly, conversational AI shopping assistant for an e-commerce store.
You help customers find products, answer questions, and complete orders via WhatsApp.
{phone_context}

SEARCH BEHAVIOUR — follow these rules strictly:
- When a customer mentions a product category (e.g. shoes, shirts, headphones), first search then immediately ask 1-2 clarifying questions to narrow down (e.g. "Are you looking for men's or women's?", "Any budget in mind?", "What size?", "Any preferred colour or style?").
- Use the answers to run a more targeted search. Stay focused on the same product category until the customer explicitly changes it.
- Never do a broad inventory dump. Show 3-5 of the most relevant results and then ask a follow-up question to refine further.
- If the customer asks a follow-up about the same category (e.g. "show me cheaper ones" or "what about in blue?"), search again within that same category — don't start over from the full catalogue.
- Keep the conversation going. After every set of results ask something like "Would any of these work, or shall I narrow it down further?"

ORDER & CHECKOUT:
- When user says "add to cart" or "I'll take this", use the add_to_cart tool, then show the cart and ask "Ready to checkout?"
- When they say yes / "checkout" / "place order": confirm their phone number first (see above), then call the checkout tool.
- After checkout, ALWAYS present the full cost breakdown using the values returned by the checkout tool:
  • Subtotal: $X.XX
  • Shipping: $X.XX (free if subtotal > $50, otherwise $5.99)
  • Tax (10%): $X.XX
  • *Total: $X.XX*
  Then share the payment link and order number. Never say you don't have the breakdown — you receive subtotal, tax, shipping, and total directly from the tool.

GENERAL:
- Be concise — WhatsApp messages should be short and easy to read.
- Use plain text, avoid heavy markdown. A little bold (*word*) is fine.
- If asked about store policies, FAQs, or product guides, use search_knowledge_base first.

Available tools:
- search_products: Semantic search across products. Input: search query (str).
- filter_products: Filter by category/price/keyword. Input: JSON with category, min_price, max_price, search_query, limit.
- get_product_details: Full details for one product. Input: product ID (int as string).
- get_recommendations: Similar or related products. Input: product ID or preference description.
- add_to_cart: Add item to cart. Input: JSON with product_id (int), quantity (int), session_id (str).
- view_cart: Show current cart. Input: session_id (str).
- clear_cart: Empty the cart. Input: session_id (str).
- checkout: Place the order. Input: JSON with session_id (str), customer_phone (str), shipping_address (optional JSON).
{kb_tool_line}"""

            # --- Observability callbacks ---
            token_cb = TokenCountCallback()
            # --- End observability setup ---

            agent_input = {"input": f"{system_prompt}\n\nUser: {user_message}"}
            result = await agent.acall(agent_input, callbacks=[token_cb])

            ai_response = result.get("output", "I'm sorry, I couldn't process that.")

            import re
            product_ids = []
            tool_calls = []

            logger.info(f"[Chat] intermediate_steps present: {'intermediate_steps' in result}, count: {len(result.get('intermediate_steps', []))}")
            for step in result.get("intermediate_steps", []):
                action, observation = step
                observation_str = str(observation)

                logger.info(f"[Chat] Scanning Observation: {observation_str[:200]}...")

                # Collect product IDs
                for match in re.finditer(r'"product_ids":\s*\[(.*?)\]', observation_str):
                    try:
                        ids = [int(i.strip()) for i in match.group(1).split(',') if i.strip().isdigit()]
                        product_ids.extend(ids)
                    except Exception as e:
                        logger.error(f"[Chat] Regex parse error: {e}")

                # Persist tool call for admin dashboard
                tool_calls.append({
                    "tool": action.tool,
                    "input": action.tool_input if isinstance(action.tool_input, str) else json.dumps(action.tool_input),
                    "output": observation_str[:2000],
                })

            # Token counts from Gemini
            token_counts = {
                "prompt_tokens": token_cb.prompt_tokens,
                "completion_tokens": token_cb.completion_tokens,
                "total_tokens": token_cb.total_tokens,
            }

            # Deduplicate and validate
            unique_ids = list(set(product_ids))
            logger.info(f"[Chat] Final unique IDs for query: {unique_ids}")

            msg_type = "product" if unique_ids else "text"
            await add_message(
                str(conversation["_id"]), "assistant", ai_response,
                {
                    "type": msg_type,
                    "tool_calls": tool_calls,
                    "token_counts": token_counts,
                }
            )

            # Update conversation state — infer from tool calls first, then response text.
            # Never downgrade a terminal state (ordered) via a low-signal follow-up message.
            STATE_PRIORITY = {"greeting": 0, "browsing": 1, "cart": 2, "checkout": 3, "ordered": 4, "error": -1}
            new_state = _infer_state(tool_calls, ai_response)
            current_state = conversation.get("state", "greeting")
            if STATE_PRIORITY.get(new_state, 0) >= STATE_PRIORITY.get(current_state, 0):
                state = new_state
            else:
                state = current_state  # preserve higher-priority state
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
