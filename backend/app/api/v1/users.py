"""User administration routes (admin only): list, get, update role/active."""

from __future__ import annotations

import re
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.db.mongo import USERS, get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.admin import UpdateUserRequest
from app.models.auth import UserOut
from app.models.common import Page
from app.models.enums import Role
from app.services import audit
from app.utils.serialize import user_out

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=Page[UserOut], summary="List users (admin)")
async def list_users(
    _: dict = Depends(require_admin),
    db=Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=200),
    role: Role | None = Query(None),
) -> dict:
    flt: dict = {}
    if role:
        flt["role"] = role.value
    if search:
        flt["$or"] = [
            {"name": {"$regex": re.escape(search.strip()), "$options": "i"}},
            {"email": {"$regex": re.escape(search.strip()), "$options": "i"}},
        ]

    total = await db[USERS].count_documents(flt)
    cursor = (
        db[USERS].find(flt, {"password_hash": 0})
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)
    return {
        "items": [user_out(d) for d in docs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/{user_id}", response_model=UserOut, summary="Get one user (admin)")
async def get_user(
    user_id: str,
    _: dict = Depends(require_admin),
    db=Depends(get_db),
) -> dict:
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found.")
    doc = await db[USERS].find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return user_out(doc)


@router.patch("/{user_id}", response_model=UserOut, summary="Update role/active (admin)")
async def update_user(
    user_id: str,
    payload: UpdateUserRequest,
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
) -> dict:
    try:
        oid = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=404, detail="User not found.")
    doc = await db[USERS].find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=404, detail="User not found.")

    # Guard: an admin may neither demote nor deactivate themselves —
    # that would lock the system out of administrative access.
    if str(admin["_id"]) == user_id:
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot deactivate your own account.",
            )
        if payload.role is not None and payload.role != Role.admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot change your own role.",
            )

    updates: dict = {}
    if payload.role is not None and payload.role.value != doc.get("role"):
        updates["role"] = payload.role.value
    if payload.is_active is not None and payload.is_active != doc.get("is_active", True):
        updates["is_active"] = payload.is_active

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db[USERS].update_one({"_id": oid}, {"$set": updates})
        doc = {**doc, **updates}

        if "role" in updates:
            await audit.record(
                db,
                action=audit.ACTION_USER_ROLE_CHANGED,
                actor_id=str(admin["_id"]),
                entity_type="user",
                entity_id=user_id,
                details=f"Role {doc.get('role')} -> {updates['role']}",
            )
        if "is_active" in updates:
            await audit.record(
                db,
                action=(
                    audit.ACTION_USER_DEACTIVATED
                    if updates["is_active"] is False
                    else audit.ACTION_USER_ACTIVATED
                ),
                actor_id=str(admin["_id"]),
                entity_type="user",
                entity_id=user_id,
                details=f"is_active -> {updates['is_active']}",
            )
    return user_out(doc)
