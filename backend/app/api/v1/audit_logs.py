"""Audit-log routes — admin only, filterable by action/actor/entity."""

from __future__ import annotations

import re

from bson import ObjectId
from fastapi import APIRouter, Depends, Query

from app.db.mongo import AUDIT_LOGS, USERS, get_db
from app.dependencies.auth import require_admin
from app.models.admin import AuditLogOut
from app.models.common import Page
from app.utils.serialize import audit_log_out

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])


@router.get("", response_model=Page[AuditLogOut], summary="List audit logs (admin)")
async def list_audit_logs(
    _: dict = Depends(require_admin),
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None, max_length=100),
    actor_id: str | None = Query(None, max_length=64),
    entity_type: str | None = Query(None, max_length=50),
) -> dict:
    flt: dict = {}
    if action:
        flt["action"] = {"$regex": "^" + re.escape(action)}
    if actor_id:
        flt["actor_id"] = actor_id
    if entity_type:
        flt["entity_type"] = entity_type

    total = await db[AUDIT_LOGS].count_documents(flt)
    cursor = (
        db[AUDIT_LOGS].find(flt)
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)

    # Batch-load distinct actors for the page.
    actor_ids = {d["actor_id"] for d in docs if d.get("actor_id")}
    actors: dict[str, dict] = {}
    if actor_ids:
        valid = []
        for a in actor_ids:
            try:
                valid.append(ObjectId(a))
            except Exception:
                continue
        if valid:
            cursor = db[USERS].find(
                {"_id": {"$in": valid}}, {"name": 1, "email": 1, "role": 1}
            )
            async for u in cursor:
                actors[str(u["_id"])] = u

    return {
        "items": [audit_log_out(d, actor=actors.get(d.get("actor_id", ""))) for d in docs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }
