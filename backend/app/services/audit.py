"""Audit logging service.

Records significant security/administrative actions into the
``audit_logs`` collection. Passwords, tokens and attachment contents
are never written here — ``details`` is a short human-readable string.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.db.mongo import AUDIT_LOGS

logger = logging.getLogger("ticket_api")

# Canonical action names (also used by the admin audit-log filter).
ACTION_REGISTER = "auth.register"
ACTION_LOGIN = "auth.login"
ACTION_LOGIN_FAILED = "auth.login_failed"
ACTION_PROFILE_UPDATED = "auth.profile_updated"

ACTION_TICKET_CREATED = "ticket.created"
ACTION_TICKET_UPDATED = "ticket.updated"
ACTION_TICKET_STATUS_CHANGED = "ticket.status_changed"
ACTION_TICKET_ASSIGNED = "ticket.assigned"
ACTION_TICKET_UNASSIGNED = "ticket.unassigned"
ACTION_MESSAGE_ADDED = "ticket.message_added"

ACTION_CATEGORY_CREATED = "category.created"
ACTION_CATEGORY_UPDATED = "category.updated"

ACTION_USER_ROLE_CHANGED = "user.role_changed"
ACTION_USER_ACTIVATED = "user.activated"
ACTION_USER_DEACTIVATED = "user.deactivated"


async def record(
    db,
    *,
    action: str,
    actor_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: str | None = None,
    ip_address: str | None = None,
) -> None:
    """Insert one audit-log entry. Failures are logged, never raised —
    audit logging must not break the user-facing operation."""
    try:
        await db[AUDIT_LOGS].insert_one(
            {
                "action": action,
                "actor_id": actor_id,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "details": details,
                "ip_address": ip_address,
                "created_at": datetime.now(timezone.utc),
            }
        )
    except Exception:  # noqa: BLE001 — audit must not break requests
        logger.warning("Failed to write audit log entry for action %r", action)
