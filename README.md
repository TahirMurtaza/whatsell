# WhatSell — E-Commerce AI Chatbot

AI-powered shopping assistant that answers product queries, recommends products, captures orders, and automates follow-ups — operating 24/7 without human intervention.

## Stack

| Layer        | Technology                          |
|-------------|-------------------------------------|
| Backend     | FastAPI (Python)                    |
| AI          | OpenAI GPT-4o + LangChain           |
| Search      | FAISS + OpenAI embeddings           |
| Database    | PostgreSQL + MongoDB                |
| Queue       | Redis + Celery                      |
| Infra       | Docker Compose                      |

## Quick Start

### Option A: Using Make (Recommended)

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY

# 2. Start all services
make up

# 3. Run database migrations
make db-migrate

# 4. Seed sample products
make db-seed
```

### Option B: Direct Docker Compose

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env and set your OPENAI_API_KEY

# 2. Start all services
docker compose up -d

# 3. Run database migrations
docker compose exec api alembic upgrade head

# 4. Seed sample products
docker compose exec api python scripts/seed.py
```

## API Endpoints

| Method | Path                          | Description                  |
|--------|-------------------------------|------------------------------|
| GET    | `/health`                     | Health check                 |
| POST   | `/api/v1/chat/`               | Send a chat message          |
| GET    | `/api/v1/chat/{id}/history`   | Get chat history             |
| GET    | `/api/v1/chat/{id}/cart`      | Get cart contents            |
| POST   | `/api/v1/chat/{id}/cart`      | Update cart (add/remove)     |
| GET    | `/api/v1/products/`           | List products                |
| GET    | `/api/v1/products/{id}`       | Get product details          |
| POST   | `/api/v1/orders/`             | Create an order              |
| GET    | `/api/v1/customers/`          | List customers               |
| POST   | `/api/v1/webhooks/whatsapp`   | WhatsApp webhook             |

## Chat Usage

```bash
# Start a conversation
curl -X POST http://localhost:8000/api/v1/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "customer_phone": "+1234567890",
    "message": "Show me wireless headphones under $300"
  }'

# Add to cart
curl -X POST http://localhost:8000/api/v1/chat/ \
  -H "Content-Type: application/json" \
  -d '{
    "customer_phone": "+1234567890",
    "message": "Add the Sony headphones to my cart",
    "session_id": "sess_abc123"
  }'
```

## Project Structure

```
whatsell/
├── app/
│   ├── api/            # FastAPI route handlers
│   ├── config.py       # Settings & env vars
│   ├── db/             # Database connections (postgres, mongo, redis)
│   ├── dependencies.py # Dependency injection
│   ├── main.py         # App entry point
│   ├── models/         # SQLAlchemy + MongoDB models
│   ├── schemas/        # Pydantic request/response schemas
│   ├── services/       # Business logic (chat, cart, vector, products, orders)
│   └── tasks/          # Celery async tasks (follow-ups, reminders)
├── alembic/            # Database migrations
├── scripts/            # Utility scripts (seed data)
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── requirements.txt
```

## Features

- **Natural language product search** — semantic search via FAISS + OpenAI embeddings
- **Product recommendations** — AI-powered suggestions based on preferences
- **Chat-to-order** — complete e-commerce flow through conversation
- **Cart management** — Redis-backed session carts with add/remove/update
- **Automated follow-ups** — Celery tasks for abandoned cart, order status, delivery reminders
- **24/7 operation** — no human intervention needed for routine interactions
