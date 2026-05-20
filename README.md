# WhatSell — AI Shopping Assistant

An AI-powered e-commerce chat platform. Customers browse products, get recommendations, and complete orders through natural conversation — plus a knowledge base that lets the AI answer questions directly from your store's uploaded documents.

---

## Features

### 🛍️ AI Shopping Chat
- **Natural language product search** — semantic search via pgvector + Gemini embeddings; ask "wireless headphones under $100" and get ranked results
- **Product cards** — rich UI cards with images, price, discount badges, stock status, and add-to-cart button streamed inline with AI messages
- **Smart recommendations** — AI suggests related products based on what you're browsing
- **Product filtering** — filter by category, price range, and availability
- **Full product details** — get specs, description, and stock info by ID

### 🛒 Cart & Orders
- **Session-based cart** — Redis-backed cart per session; add, remove, update quantities
- **Live cart badge** — header icon updates in real time as items are added
- **Chat-to-order** — say "checkout" and the agent creates an order and returns a payment link
- **Order tracking** — look up any order by order number through chat
- **Customer history** — MongoDB stores every conversation and message per session

### 📚 Knowledge Base (RAG)
- **Document upload** — upload `.txt`, `.pdf`, or `.docx` files (up to 10 MB each)
- **Background processing** — Celery worker parses, chunks, and embeds documents asynchronously; status updates live in the UI
- **Strict RAG answers** — the AI answers *only* from uploaded content; refuses to use outside knowledge
- **Source attribution** — responses cite which document the answer came from
- **Document management** — list and delete documents per session; status badges (pending / processing / ready / error)

### 🔗 KB + Shopping Chat Integration
- **Unified assistant** — the shopping chat can also search the knowledge base in the same conversation
- **Automatic routing** — the LangChain agent picks `search_knowledge_base` for policy/FAQ/manual questions and product tools for shopping queries
- **Session linking** — the KB session is read from `localStorage` and forwarded with every chat message; no manual wiring needed

### ⚙️ Automation
- **Celery background tasks** — product embedding generation, document processing, order follow-ups
- **Automated follow-ups** — abandoned cart reminders, order status notifications, delivery confirmations, review requests via WhatsApp
- **Periodic embedding** — new products are automatically embedded every 2 minutes

### 📡 WhatsApp
- **Twilio webhook** — receive and reply to WhatsApp messages through the same AI pipeline
- **Session continuity** — phone number mapped to chat session for returning customers

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python 3.12) |
| AI / LLM | Google Gemini 1.5 Flash via LangChain |
| Embeddings | Gemini `models/gemini-embedding-001` (3072-dim) |
| Vector Search | pgvector (PostgreSQL extension) |
| Agent Framework | LangChain CONVERSATIONAL_REACT_DESCRIPTION |
| Relational DB | PostgreSQL 16 |
| Chat History | MongoDB 7 |
| Session Cache | Redis 7 |
| Task Queue | Celery 5 + Redis broker |
| Document Parsing | pypdf (PDF), python-docx (DOCX) |
| Frontend | Next.js 16 + React 19 + AI SDK v3 |
| UI Components | Lucide React, Framer Motion |
| Infra | Docker Compose |

---

## Quick Start

```bash
# 1. Copy and configure environment
cp .env.example .env
# Edit .env — set GEMINI_API_KEY, TWILIO_SID, TWILIO_TOKEN (optional)

# 2. Start all services
docker compose up -d

# 3. Run database migrations
docker compose exec api alembic upgrade head

# 4. Seed sample products
docker compose exec api python scripts/seed.py

# 5. Generate product embeddings (or wait ~2 min for Celery Beat)
docker compose exec api python -c "from app.tasks.embeddings import embed_missing_products; embed_missing_products()"
```

**Frontend:** http://localhost:3000  
**API docs:** http://localhost:8000/docs  
**Backend API:** http://localhost:8000

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key (required) | — |
| `GEMINI_MODEL` | Gemini model name | `gemini-1.5-flash` |
| `POSTGRES_*` | PostgreSQL connection settings | see `.env.example` |
| `MONGO_URI` | MongoDB connection URI | `mongodb://mongodb:27017` |
| `REDIS_HOST` | Redis host | `redis` |
| `TWILIO_SID` | Twilio account SID (WhatsApp, optional) | — |
| `TWILIO_TOKEN` | Twilio auth token (optional) | — |
| `PHONE_NUMBER` | WhatsApp sender number (optional) | — |

---

## API Reference

### Chat

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/chat/` | Send a message; returns AI reply + products |
| `GET` | `/api/v1/chat/{session_id}/history` | Conversation history |
| `GET` | `/api/v1/chat/{session_id}/cart` | Cart contents |
| `POST` | `/api/v1/chat/{session_id}/cart` | Update cart (add / remove / update / clear) |

```bash
# Shopping chat with KB wired in
curl -X POST http://localhost:8000/api/v1/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "customer_phone": "+1234567890",
    "message": "What is your return policy?",
    "session_id": "sess_abc123",
    "kb_session_id": "kb_xyz789"
  }'
```

### Knowledge Base

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/documents/upload` | Upload a document (multipart form) |
| `GET` | `/api/v1/documents/?session_id=` | List documents for a session |
| `DELETE` | `/api/v1/documents/{id}?session_id=` | Delete a document + its chunks |
| `POST` | `/api/v1/kb/chat` | Strict RAG chat (KB only, no outside knowledge) |

```bash
# Upload a PDF
curl -X POST http://localhost:8000/api/v1/documents/upload \
  -F "file=@store_policies.pdf;type=application/pdf" \
  -F "session_id=kb_xyz789"

# Ask a question (streams plain text)
curl -X POST http://localhost:8000/api/v1/kb/chat \
  -H "Content-Type: application/json" \
  -d '{"session_id": "kb_xyz789", "message": "What is the warranty period?"}'
```

### Products & Orders

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/products/` | List / search products |
| `GET` | `/api/v1/products/{id}` | Product detail |
| `POST` | `/api/v1/orders/` | Create order |
| `GET` | `/api/v1/orders/{id}` | Order detail |
| `GET` | `/api/v1/customers/` | List customers |
| `POST` | `/api/v1/webhooks/whatsapp` | Twilio WhatsApp webhook |
| `GET` | `/api/v1/analytics/` | Basic analytics |

---

## Project Structure

```
whatsell/
├── app/
│   ├── api/
│   │   ├── chat.py           # Shopping chat endpoints
│   │   ├── documents.py      # KB upload / list / delete
│   │   ├── kb_chat.py        # Strict RAG chat endpoint
│   │   ├── products.py
│   │   ├── orders.py
│   │   ├── customers.py
│   │   ├── analytics.py
│   │   ├── webhooks.py       # WhatsApp Twilio webhook
│   │   └── health.py
│   ├── services/
│   │   ├── chat_service.py   # LangChain agent + all tools
│   │   ├── kb_service.py     # RAG pipeline (parse→chunk→embed→search)
│   │   ├── vector_service.py # pgvector product search
│   │   ├── cart_service.py   # Redis cart
│   │   ├── product_service.py
│   │   ├── order_service.py
│   │   ├── customer_service.py
│   │   └── payment_service.py
│   ├── tasks/
│   │   ├── celery.py         # Celery app + beat schedule
│   │   ├── embeddings.py     # Product embedding Celery task
│   │   ├── documents.py      # KB document processing task
│   │   └── followups.py      # WhatsApp follow-up tasks
│   ├── models/
│   │   ├── postgres.py       # SQLAlchemy models (Product, Order, Customer, Document, DocumentChunk)
│   │   └── mongodb.py        # Conversation + message helpers
│   ├── db/
│   │   ├── postgres.py       # Async + sync engines
│   │   ├── mongodb.py        # Motor client
│   │   └── redis.py
│   ├── schemas/              # Pydantic request/response models
│   ├── config.py             # Settings (pydantic-settings)
│   └── main.py
├── alembic/                  # Database migrations
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx          # Shopping chat UI
│   │   ├── kb/page.tsx       # Knowledge base UI
│   │   └── api/
│   │       ├── chat/route.ts     # Next.js → backend proxy
│   │       └── kb/chat/route.ts  # KB chat proxy
│   └── src/components/
│       ├── MessageItem.tsx
│       ├── ProductCard.tsx
│       ├── DocumentUpload.tsx
│       ├── DocumentList.tsx
│       └── SourceCard.tsx
├── scripts/                  # seed.py, etc.
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## How the KB + Chat Integration Works

1. Open `/kb`, upload your store documents (FAQs, manuals, return policy PDF, etc.)
2. The Celery worker parses and embeds each document in the background
3. Open the shopping chat `/` — the `kb_session_id` is read automatically from `localStorage`
4. Every chat message now carries both the chat `session_id` and the `kb_session_id`
5. The LangChain agent has a `search_knowledge_base` tool available alongside its product tools
6. For policy/FAQ/manual questions the agent searches your documents; for product queries it uses the product catalog — both in the same conversation

```
User: "What headphones do you have under $100?"
→ Agent uses search_products tool → returns product cards

User: "What is your return policy for electronics?"
→ Agent uses search_knowledge_base tool → answers from your uploaded FAQ document
```

---

## Database Schema

### PostgreSQL (relational + vector)

| Table | Purpose |
|-------|---------|
| `products` | Product catalog with 3072-dim Gemini embeddings |
| `customers` | Customer profiles |
| `orders` | Orders with line items and payment status |
| `documents` | Knowledge base document metadata + processing status |
| `document_chunks` | Chunked text with 3072-dim embeddings for RAG search |

### MongoDB

| Collection | Purpose |
|-----------|---------|
| `conversations` | One per session; tracks state and context |
| `messages` | Every user and assistant message with timestamps |

### Redis

| Key pattern | Purpose |
|-------------|---------|
| `cart:{session_id}` | Shopping cart (items, totals) |
| Celery queues | Task broker and result backend |
