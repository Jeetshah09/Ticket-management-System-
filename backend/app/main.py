"""FastAPI application factory and lifespan.

Fail-fast startup: essential configuration (JWT_SECRET) is validated
before serving, and the MongoDB connection is pinged with a clear
error message if unreachable.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import api_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.rate_limit import SlidingWindowRateLimiter
from app.db.mongo import connect

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("ticket_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings: Settings = app.state.settings

    # --- fail fast on missing/placeholder secrets -------------------------
    missing = settings.missing_essential()
    if missing:
        raise RuntimeError(
            "Refusing to start: missing essential configuration: "
            + ", ".join(missing)
            + ". Copy backend/.env.example to backend/.env and set real values."
        )

    # --- database ---------------------------------------------------------
    client, db = await connect(settings.mongo_uri, settings.mongo_db)
    app.state.mongo_client = client
    app.state.db = db
    app.state.rate_limiter = SlidingWindowRateLimiter()
    logger.info("Started %s (docs at /docs)", settings.app_name)

    try:
        yield
    finally:
        await client.aclose()
        logger.info("MongoDB connection closed.")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory — used by main.py and by tests (which pass
    their own Settings for an isolated test database)."""
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description=(
            "Ticket Management System API. Roles: customer, agent, admin. "
            "All authorization is enforced server-side."
        ),
        lifespan=lifespan,
    )
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        # Origins come from the environment (CORS_ORIGINS), never hardcoded.
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", include_in_schema=False)
    async def root() -> dict:
        return {"name": settings.app_name, "docs": "/docs", "api": settings.api_v1_prefix}

    return app


app = create_app()
