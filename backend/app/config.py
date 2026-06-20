"""Application configuration, loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "HelioSphere AI"
    version: str = "1.0.0"
    env: str = "development"
    debug: bool = True

    # Security
    secret_key: str = "change-me-to-a-long-random-string-in-production"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"

    # Database
    database_url: str = "sqlite+aiosqlite:///./heliosphere.db"

    # CORS
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # HelioGPT copilot — Groq (llama-3.3-70b-versatile). Without a key the
    # grounded rule-based engine answers — copilot always works offline.
    groq_api_key: str | None = None

    # Background ingestion
    scheduler_enabled: bool = True
    ingest_interval_seconds: int = 60

    # Optional live upstream (NOAA SWPC). If unreachable, synthetic data is used.
    use_live_upstream: bool = False

    # Bootstrapped admin
    admin_email: str = "admin@heliosphere.ai"
    admin_password: str = "helioadmin123"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
