"""Application configuration.

Values come from environment variables (preferred) or a `.env` file in
the working directory. Secrets are never hard-coded.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "Ticket Management API"
    api_v1_prefix: str = "/api/v1"

    # Database
    mongo_uri: str = "mongodb://127.0.0.1:27017"
    mongo_db: str = "ticket_management_db"

    # Auth — validated at startup (see app.main lifespan).
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 720

    # Security
    cors_origins: str = "http://localhost:3000,http://localhost:5173"
    auth_rate_limit_per_minute: int = 10
    # Invite code required to self-register as an admin (customers and
    # agents register without one). Empty = admin self-registration is
    # disabled; admins must be created via scripts/create_admin.py.
    admin_invite_code: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def missing_essential(self) -> list[str]:
        """Names of essential settings that are absent (fail-fast check)."""
        missing = []
        if not self.jwt_secret.strip():
            missing.append("JWT_SECRET")
        elif self.jwt_secret.strip() == "change-me-to-a-long-random-string":
            missing.append("JWT_SECRET (still the .env.example placeholder)")
        return missing


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — one object shared by app and tests."""
    return Settings()
