from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "whatsell"
    app_env: str = "development"
    debug: bool = False
    secret_key: str = "change-me-in-production"
    api_prefix: str = "/api/v1"

    # PostgreSQL
    postgres_user: str = "whatsell"
    postgres_password: str = "whatsell_secret"
    postgres_db: str = "whatsell_db"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    # MongoDB
    mongo_uri: str = "mongodb://mongodb:27017"
    mongo_db: str = "whatsell_conversations"

    # Redis
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_db: int = 0

    # Google Gemini
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    # Celery
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/2"

    # WhatsApp
    whatsapp_verify_token: str = ""
    whatsapp_access_token: str = ""

    @property
    def postgres_url(self) -> str:
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    @property
    def postgres_sync_url(self) -> str:
        return f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    @property
    def celery_broker(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/1"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
