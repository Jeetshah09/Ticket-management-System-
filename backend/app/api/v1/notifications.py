"""Notification routes — always scoped to the authenticated user."""

from __future__ import annotations

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.mongo import NOTIFICATIONS, get_db
from app.dependencies.auth import get_current_user
from app.models.notification import NotificationOut, NotificationPage
from app.utils.serialize import notification_out

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationPage, summary="List own notifications")
async def list_notifications(
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
) -> dict:
    flt: dict = {"user_id": str(user["_id"])}
    if unread_only:
        flt["is_read"] = False

    total = await db[NOTIFICATIONS].count_documents(flt)
    cursor = (
        db[NOTIFICATIONS].find(flt)
        .sort("created_at", -1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)
    unread_count = await db[NOTIFICATIONS].count_documents(
        {"user_id": str(user["_id"]), "is_read": False}
    )
    return {
        "items": [notification_out(d) for d in docs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
        "unread_count": unread_count,
    }


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationOut,
    summary="Mark one notification as read",
)
async def mark_read(
    notification_id: str,
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        oid = ObjectId(notification_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Notification not found.")
    # Scope by user_id so a foreign id reads as 404, never 403-leak.
    doc = await db[NOTIFICATIONS].find_one(
        {"_id": oid, "user_id": str(user["_id"])}
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if not doc.get("is_read", False):
        await db[NOTIFICATIONS].update_one(
            {"_id": oid}, {"$set": {"is_read": True}}
        )
        doc = {**doc, "is_read": True}
    return notification_out(doc)


@router.post("/read-all", summary="Mark all own notifications as read")
async def mark_all_read(
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    result = await db[NOTIFICATIONS].update_many(
        {"user_id": str(user["_id"]), "is_read": False},
        {"$set": {"is_read": True}},
    )
    return {"marked": result.modified_count}
