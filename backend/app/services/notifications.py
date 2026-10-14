"""In-app notification creation.

Notifications are created server-side for: ticket creation (to the
agent pool), assignment, public replies and status changes. Each user
only ever sees their own notifications (enforced in the router).
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.db.mongo import NOTIFICATIONS, USERS

logger = logging.getLogger("ticket_api")


async def create(
    db,
    *,
    user_id: str,
    title: str,
    body: str | None = None,
    ticket_id: str | None = None,
) -> None:
    """Insert one notification for one user. Never raises."""
    try:
        await db[NOTIFICATIONS].insert_one(
            {
                "user_id": user_id,
                "title": title,
                "body": body,
                "ticket_id": ticket_id,
                "is_read": False,
                "created_at": datetime.now(timezone.utc),
            }
        )
    except Exception:  # noqa: BLE001 — notifications must not break requests
        logger.warning("Failed to create notification for user %s", user_id)


async def create_for_many(
    db, *, user_ids: list[str], title: str, body: str | None = None, ticket_id: str | None = None
) -> None:
    """Insert the same notification for several users. Never raises."""
    unique = {uid for uid in user_ids if uid}
    if not unique:
        return
    now = datetime.now(timezone.utc)
    try:
        await db[NOTIFICATIONS].insert_many(
            [
                {
                    "user_id": uid,
                    "title": title,
                    "body": body,
                    "ticket_id": ticket_id,
                    "is_read": False,
                    "created_at": now,
                }
                for uid in unique
            ],
            ordered=False,
        )
    except Exception:  # noqa: BLE001
        logger.warning("Failed to create batch notifications for ticket %s", ticket_id)


async def agent_pool_ids(db) -> list[str]:
    """Ids of active agents + admins (ticket-watchers who get queue notifications)."""
    cursor = db[USERS].find(
        {"role": {"$in": ["agent", "admin"]}, "is_active": True},
        {"_id": 1},
    )
    docs = await cursor.to_list(length=None)
    return [str(d["_id"]) for d in docs]
