.PHONY: help up down db-migrate db-seed logs shell test clean

help:
	@echo "Available commands:"
	@echo "  make up          - Start all services (docker compose)"
	@echo "  make down        - Stop all services"
	@echo "  make db-migrate  - Run Alembic migrations"
	@echo "  make db-seed     - Seed database with sample products"
	@echo "  make logs        - Follow API logs"
	@echo "  make shell       - Open shell in API container"
	@echo "  make test        - Run tests"
	@echo "  make clean       - Remove containers and volumes"

up:
	docker compose up -d

down:
	docker compose down

db-migrate:
	docker compose exec api alembic upgrade head

db-seed:
	docker compose exec api python scripts/seed.py

logs:
	docker compose logs -f api

shell:
	docker compose exec api /bin/bash

test:
	docker compose exec api pytest tests/ -v

clean:
	docker compose down -v --remove-orphans
