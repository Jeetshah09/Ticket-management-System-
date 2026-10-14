"""Analytics aggregations (role-scoped, MongoDB aggregation pipelines).

Customers/agents get metrics scoped to the tickets they can see;
admins get system-wide metrics plus user/category counts. Aggregates
never expose individual other customers' data.

Note: with PyMongo's async API, ``await db.coll.aggregate(pipeline)``
yields the command cursor (pymongo 4.11), which is then iterated.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db.mongo import CATEGORIES, TICKETS, USERS
from app.models.enums import (
    ACTIVE_STATUSES,
    DONE_STATUSES,
    PRIORITY_LABELS,
    PRIORITY_ORDER,
    STATUS_LABELS,
    STATUS_ORDER,
)
from app.services.tickets import visibility_filter
from app.utils.serialize import metric_bucket, user_summary


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def overview(db, user: dict) -> dict:
    role = user.get("role", "customer")
    scope = await visibility_filter(user)

    total = await db[TICKETS].count_documents(scope)
    open_count = await db[TICKETS].count_documents({**scope, "status": {"$in": ACTIVE_STATUSES}})
    resolved_count = await db[TICKETS].count_documents({**scope, "status": {"$in": DONE_STATUSES}})

    async def bucket_counts(field: str, labels: dict[str, str], order: list[str]) -> list[dict]:
        pipeline = [
            {"$match": scope or {}},
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
        ]
        cursor = await db[TICKETS].aggregate(pipeline)
        raw = {row["_id"]: row["count"] async for row in cursor}
        return [metric_bucket(key, raw.get(key, 0)) for key in order]

    by_status = await bucket_counts("status", STATUS_LABELS, STATUS_ORDER)
    by_priority = await bucket_counts("priority", PRIORITY_LABELS, PRIORITY_ORDER)

    # Category breakdown (keys are category ids; label is the name).
    cat_pipeline = [
        {"$match": scope or {}},
        {"$group": {"_id": "$category_id", "count": {"$sum": 1}}},
    ]
    cat_cursor = await db[TICKETS].aggregate(cat_pipeline)
    cat_rows = [(row["_id"], row["count"]) async for row in cat_cursor]
    cat_names: dict[str, str] = {}
    cat_ids = [c for c, _ in cat_rows if c]
    if cat_ids:
        from bson import ObjectId

        name_cursor = db[CATEGORIES].find(
            {"_id": {"$in": [ObjectId(c) for c in cat_ids]}}, {"name": 1}
        )
        async for cat in name_cursor:
            cat_names[str(cat["_id"])] = cat.get("name", "Uncategorized")
    by_category = [
        metric_bucket(cat_names.get(cid or "", "Uncategorized"), count) for cid, count in cat_rows
    ]

    # Daily creation trend for the last 14 days.
    since = _utcnow() - timedelta(days=13)
    since = since.replace(hour=0, minute=0, second=0, microsecond=0)
    trend_pipeline = [
        {"$match": {**scope, "created_at": {"$gte": since}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "count": {"$sum": 1},
            }
        },
    ]
    trend_cursor = await db[TICKETS].aggregate(trend_pipeline)
    daily = {row["_id"]: row["count"] async for row in trend_cursor}
    created_trend = []
    for offset in range(14):
        day = (since + timedelta(days=offset)).strftime("%Y-%m-%d")
        created_trend.append({"date": day, "count": daily.get(day, 0)})

    result = {
        "total_tickets": total,
        "open_tickets": open_count,
        "resolved_tickets": resolved_count,
        "by_status": by_status,
        "by_priority": by_priority,
        "by_category": by_category,
        "created_trend": created_trend,
    }

    if role == "admin":
        result["unassigned_tickets"] = await db[TICKETS].count_documents(
            {**scope, "assignee_id": None}
        )
        result["total_users"] = await db[USERS].count_documents({})
        result["total_categories"] = await db[CATEGORIES].count_documents({})

    return result


async def agent_workloads(db) -> list[dict]:
    """Admin-only: per-agent open/total ticket counts."""
    pipeline = [
        {"$match": {"assignee_id": {"$ne": None}}},
        {
            "$group": {
                "_id": "$assignee_id",
                "total_tickets": {"$sum": 1},
                "open_tickets": {
                    "$sum": {"$cond": [{"$in": ["$status", ACTIVE_STATUSES]}, 1, 0]}
                },
            }
        },
    ]
    cursor = await db[TICKETS].aggregate(pipeline)
    rows = [(row["_id"], row["open_tickets"], row["total_tickets"]) async for row in cursor]
    if not rows:
        return []

    from bson import ObjectId

    user_cursor = db[USERS].find(
        {"_id": {"$in": [ObjectId(a) for a, _, _ in rows]}},
        {"name": 1, "email": 1, "role": 1},
    )
    users = {str(u["_id"]): u async for u in user_cursor}

    return [
        {
            "agent": user_summary(users.get(agent_id)),
            "open_tickets": open_count,
            "total_tickets": total,
        }
        for agent_id, open_count, total in rows
        if agent_id in users
    ]
