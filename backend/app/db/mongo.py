"""MongoDB connection lifecycle and index initialization.

Async approach: PyMongo's built-in async API (`AsyncMongoClient`,
available since pymongo 4.11) instead of Motor — the installed driver
already provides it, which keeps the dependency list short. Cursor
notes (pymongo 4.11/4.12+ compatible):

* ``find(...)`` returns a cursor directly: ``await cursor.to_list()``
* ``await coll.aggregate(pipeline)`` first, then ``await cursor.to_list()``
"""

from __future__ import annotations

import logging

from fastapi import Request
from pymongo import AsyncMongoClient

try:  # pymongo >= 4.12 exports AsyncDatabase at the top level.
    from pymongo import AsyncDatabase
except ImportError:  # pymongo 4.11 keeps it in the asynchronous subpackage.
    from pymongo.asynchronous.database import AsyncDatabase

logger = logging.getLogger("ticket_api")

# Collection names (single source of truth).
USERS = "users"
TICKETS = "tickets"
MESSAGES = "ticket_messages"
CATEGORIES = "categories"
NOTIFICATIONS = "notifications"
AUDIT_LOGS = "audit_logs"
COUNTERS = "counters"


async def connect(mongo_uri: str, mongo_db: str) -> tuple[AsyncMongoClient, AsyncDatabase]:
    """Create a client, ping the server (fail fast) and build indexes."""
    client = AsyncMongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    try:
        await client.admin.command("ping")
    except Exception as exc:  # noqa: BLE001 — translate to a clear startup error
        await client.aclose()
        raise RuntimeError(
            f"Cannot reach MongoDB at {mongo_uri!r}: {exc}. "
            "Start MongoDB or set MONGO_URI in backend/.env."
        ) from exc
    db = client[mongo_db]
    await ensure_indexes(db)
    logger.info("Connected to MongoDB database %r", mongo_db)
    return client, db


async def ensure_indexes(db: AsyncDatabase) -> None:
    """Create indexes safely (create_index is idempotent)."""
    await db[USERS].create_index([("email", 1)], unique=True)
    await db[USERS].create_index([("role", 1), ("is_active", 1)])
    await db[USERS].create_index([("password_reset_token", 1)], sparse=True)

    await db[TICKETS].create_index([("ticket_number", 1)], unique=True)
    await db[TICKETS].create_index([("requester_id", 1), ("created_at", -1)])
    await db[TICKETS].create_index([("assignee_id", 1), ("created_at", -1)])
    await db[TICKETS].create_index([("status", 1)])
    await db[TICKETS].create_index([("priority", 1)])
    await db[TICKETS].create_index([("category_id", 1)])
    await db[TICKETS].create_index([("created_at", -1)])
    await db[TICKETS].create_index([("updated_at", -1)])

    await db[MESSAGES].create_index([("ticket_id", 1), ("created_at", 1)])
    await db[CATEGORIES].create_index([("name", 1)], unique=True)

    await db[NOTIFICATIONS].create_index([("user_id", 1), ("created_at", -1)])
    await db[NOTIFICATIONS].create_index([("user_id", 1), ("is_read", 1)])

    await db[AUDIT_LOGS].create_index([("created_at", -1)])
    await db[AUDIT_LOGS].create_index([("action", 1)])
    await db[AUDIT_LOGS].create_index([("actor_id", 1)])
    await db[AUDIT_LOGS].create_index([("entity_type", 1), ("entity_id", 1)])


def get_db(request: Request) -> AsyncDatabase:
    """FastAPI dependency returning the application database handle."""
    return request.app.state.db
