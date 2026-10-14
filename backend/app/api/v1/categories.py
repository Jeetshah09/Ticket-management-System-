"""Category routes.

Policy: categories are never hard-deleted (existing tickets keep their
``category_id`` and history). Admins deactivate them instead, which
hides them from the create-ticket form while preserving old data.
"""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.db.mongo import CATEGORIES, TICKETS, get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.models.common import Page
from app.services import audit
from app.utils.serialize import category_out

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=Page[CategoryOut], summary="List categories")
async def list_categories(
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
    include_inactive: bool = Query(False, description="Admin only"),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=200),
) -> dict:
    flt: dict = {}
    if not (include_inactive and user.get("role") == "admin"):
        flt["is_active"] = True

    total = await db[CATEGORIES].count_documents(flt)
    cursor = (
        db[CATEGORIES].find(flt)
        .sort("name", 1)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)
    return {
        "items": [category_out(d) for d in docs],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.post(
    "",
    response_model=CategoryOut,
    status_code=201,
    summary="Create a category (admin)",
)
async def create_category(
    payload: CategoryCreate,
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
) -> dict:
    existing = await db[CATEGORIES].find_one({"name": payload.name})
    if existing is not None:
        raise HTTPException(status_code=409, detail="A category with this name already exists.")

    now = datetime.now(timezone.utc)
    doc = {
        "name": payload.name,
        "description": payload.description,
        "is_active": payload.is_active,
        "created_at": now,
        "updated_at": now,
    }
    result = await db[CATEGORIES].insert_one(doc)
    doc["_id"] = result.inserted_id

    await audit.record(
        db,
        action=audit.ACTION_CATEGORY_CREATED,
        actor_id=str(admin["_id"]),
        entity_type="category",
        entity_id=str(result.inserted_id),
        details=f"Category '{payload.name}' created",
    )
    return category_out(doc)


@router.patch("/{category_id}", response_model=CategoryOut, summary="Update category (admin)")
async def update_category(
    category_id: str,
    payload: CategoryUpdate,
    admin: dict = Depends(require_admin),
    db=Depends(get_db),
) -> dict:
    try:
        oid = ObjectId(category_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Category not found.")
    doc = await db[CATEGORIES].find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=404, detail="Category not found.")

    updates = payload.model_dump(exclude_unset=True)
    if "name" in updates and updates["name"] != doc.get("name"):
        clash = await db[CATEGORIES].find_one(
            {"name": updates["name"], "_id": {"$ne": oid}}
        )
        if clash is not None:
            raise HTTPException(
                status_code=409, detail="A category with this name already exists."
            )

    # Deactivation is allowed even when tickets reference this category:
    # history is preserved; the category just disappears from the form.
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc)
        await db[CATEGORIES].update_one({"_id": oid}, {"$set": updates})
        doc = {**doc, **updates}
        await audit.record(
            db,
            action=audit.ACTION_CATEGORY_UPDATED,
            actor_id=str(admin["_id"]),
            entity_type="category",
            entity_id=category_id,
            details=f"Updated: {', '.join(updates.keys())}",
        )
    return category_out(doc)


@router.get(
    "/{category_id}/usage",
    summary="How many tickets reference this category (admin)",
)
async def category_usage(
    category_id: str,
    _: dict = Depends(require_admin),
    db=Depends(get_db),
) -> dict:
    try:
        oid = ObjectId(category_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Category not found.")
    doc = await db[CATEGORIES].find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    count = await db[TICKETS].count_documents({"category_id": category_id})
    return {"category_id": category_id, "ticket_count": count}
