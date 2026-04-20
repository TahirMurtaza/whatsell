import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import json


@pytest.fixture
def mock_settings():
    with patch("app.config.get_settings") as mock:
        settings = MagicMock()
        settings.app_name = "whatsell-test"
        settings.app_env = "testing"
        settings.debug = False
        settings.secret_key = "test-secret"
        settings.api_prefix = "/api/v1"
        settings.postgres_url = "postgresql+asyncpg://test:test@localhost:5432/test"
        settings.mongo_uri = "mongodb://localhost:27017"
        settings.mongo_db = "test_whatsell"
        settings.redis_host = "localhost"
        settings.redis_port = 6379
        settings.redis_db = 0
        settings.gemini_api_key = "test-gemini-key"
        settings.gemini_model = "gemini-2.0-flash"
        settings.celery_broker_url = "redis://localhost:6379/1"
        settings.celery_result_backend = "redis://localhost:6379/2"
        settings.whatsapp_verify_token = "test-token"
        settings.whatsapp_access_token = "test-access"
        mock.return_value = settings
        yield settings


@pytest.fixture
def client(mock_settings):
    with patch("app.services.chat_service.chat_service") as mock_chat:
        mock_chat.initialized = True
        mock_chat.process_message = AsyncMock(
            return_value={
                "content": "Test response",
                "session_id": "test_session",
                "state": "browsing",
                "products": [],
                "type": "text",
            }
        )
        mock_chat.get_chat_history = AsyncMock(return_value=[])
        mock_chat.cart_service = MagicMock()
        mock_chat.cart_service.get_cart = AsyncMock(
            return_value={
                "items": [],
                "subtotal": 0.0,
                "total_items": 0,
            }
        )

        from app.main import app

        with TestClient(app) as test_client:
            yield test_client


class TestHealthEndpoint:
    def test_health_check(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


class TestChatEndpoint:
    def test_send_message(self, client):
        response = client.post(
            "/api/v1/chat/",
            json={
                "customer_phone": "+1234567890",
                "message": "Show me wireless headphones",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "reply" in data
        assert "session_id" in data
        assert "state" in data

    def test_send_message_with_session(self, client):
        response = client.post(
            "/api/v1/chat/",
            json={
                "customer_phone": "+1234567890",
                "message": "Add to cart",
                "session_id": "existing_session",
            },
        )
        assert response.status_code == 200

    def test_get_chat_history(self, client):
        response = client.get("/api/v1/chat/test_session/history")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_cart(self, client):
        response = client.get("/api/v1/chat/test_session/cart")
        assert response.status_code == 200


class TestProductsEndpoint:
    @patch("app.api.products.product_service.get_products")
    def test_list_products(self, mock_get_products, client):
        mock_get_products.return_value = ([], 0)
        response = client.get("/api/v1/products/")
        assert response.status_code == 200


class TestOrdersEndpoint:
    @patch("app.api.orders.order_service.get_orders")
    def test_list_orders(self, mock_get_orders, client):
        mock_get_orders.return_value = []
        response = client.get("/api/v1/orders/")
        assert response.status_code == 200


class TestCustomersEndpoint:
    @patch("app.api.customers.customer_service.get_customers")
    def test_list_customers(self, mock_get_customers, client):
        mock_get_customers.return_value = []
        response = client.get("/api/v1/customers/")
        assert response.status_code == 200


class TestCartService:
    @pytest.fixture
    def cart_service(self):
        from app.services.cart_service import CartService

        return CartService()

    @pytest.mark.asyncio
    async def test_add_to_cart(self, cart_service):
        with patch("app.services.cart_service.redis") as mock_redis:
            mock_redis.get.return_value = None
            mock_redis.set = AsyncMock()

            cart = await cart_service.add_to_cart(
                "test_session", 1, "Test Product", 99.99, 2
            )
            assert cart["total_items"] == 2
            assert cart["subtotal"] == 199.98
            assert len(cart["items"]) == 1

    @pytest.mark.asyncio
    async def test_empty_cart_summary(self, cart_service):
        with patch("app.services.cart_service.redis") as mock_redis:
            mock_redis.get.return_value = None
            summary = await cart_service.get_cart_summary("test_session")
            assert "empty" in summary.lower()
