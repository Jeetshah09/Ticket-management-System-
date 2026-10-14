"""Serialize Mongo documents into the API's response shapes.

All ``_id`` ObjectIds are converted to lowercase hex strings, which is
the only ObjectId exposure in the API (the frontend treats ids as
opaque strings).
"""

from __future__ import annotations

from app.models.enums import PRIORITY_LABELS, STATUS_LABELS


def user_summary(doc: dict | None) -> dict | None:
    if not doc:
        return None
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "email": doc.get("email", ""),
        "role": doc.get("role", "customer"),
    }


def user_out(doc: dict | None) -> dict | None:
    summary = user_summary(doc)
    if summary is None:
        return None
    summary.update(
        {
            "is_active": doc.get("is_active", True),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        }
    )
    return summary


def category_out(doc: dict | None) -> dict | None:
    if not doc:
        return None
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "description": doc.get("description"),
        "is_active": doc.get("is_active", True),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


def category_brief(doc: dict | None) -> dict | None:
    if not doc:
        return None
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "description": doc.get("description"),
        "is_active": doc.get("is_active", True),
    }


def ticket_out(
    doc: dict,
    *,
    category: dict | None = None,
    requester: dict | None = None,
    assignee: dict | None = None,
    resolver: dict | None = None,
) -> dict:
    return {
        "id": str(doc["_id"]),
        "ticket_number": doc.get("ticket_number"),
        "subject": doc.get("subject", ""),
        "description": doc.get("description", ""),
        "status": doc.get("status", "open"),
        "priority": doc.get("priority", "medium"),
        "category": category_brief(category),
        "category_id": doc.get("category_id"),
        "requester": user_summary(requester),
        "assignee": user_summary(assignee),
        "resolved_by": user_summary(resolver),
        "resolved_at": doc.get("resolved_at"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
        "message_count": doc.get("message_count", 0),
    }


def message_out(doc: dict, *, author: dict | None) -> dict:
    return {
        "id": str(doc["_id"]),
        "ticket_id": doc.get("ticket_id"),
        "author": user_summary(author),
        "body": doc.get("body", ""),
        "visibility": doc.get("visibility", "public"),
        "created_at": doc.get("created_at"),
    }


def notification_out(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title", ""),
        "body": doc.get("body"),
        "ticket_id": doc.get("ticket_id"),
        "is_read": doc.get("is_read", False),
        "created_at": doc.get("created_at"),
    }


def audit_log_out(doc: dict, *, actor: dict | None) -> dict:
    return {
        "id": str(doc["_id"]),
        "action": doc.get("action", ""),
        "actor": user_summary(actor),
        "entity_type": doc.get("entity_type"),
        "entity_id": doc.get("entity_id"),
        "details": doc.get("details"),
        "ip_address": doc.get("ip_address"),
        "created_at": doc.get("created_at"),
    }


def metric_bucket(key: str, count: int) -> dict:
    return {
        "key": key,
        "label": STATUS_LABELS.get(key) or PRIORITY_LABELS.get(key) or key.title(),
        "count": count,
    }
