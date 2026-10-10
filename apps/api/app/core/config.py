from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.db.url import normalize_database_url


class Settings(BaseSettings):
    """Application settings, read from environment variables prefixed ESKANBAN_."""

    model_config = SettingsConfigDict(env_prefix="ESKANBAN_", env_file=".env", extra="ignore")

    env: str = "local"
    cors_origins: str = "http://localhost:3000"
    database_url: str = "postgresql+psycopg://eskanban:eskanban@localhost:5432/eskanban"

    # Sessions: sliding idle expiry, capped by an absolute maximum lifetime.
    session_idle_days: int = 7
    session_max_days: int = 30
    # Brute-force protection per account.
    max_failed_logins: int = 5
    lockout_minutes: int = 15

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        return normalize_database_url(value)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def docs_enabled(self) -> bool:
        # Interactive API docs are hidden in production.
        return self.env != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
