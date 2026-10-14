"""Ticket domain services: visibility rules, lifecycle, conversation.

Business rules live here (not in routers) so they are unit-testable:

* Visibility: customers see only tickets they requested; agents see
  their own + tickets assigned to them + unassigned queue tickets;
  admins see everything.
* Status transitions are validated against ``ALLOWED_TRANSITIONS``.
* Customers may only edit subject/description/category/priority of
  their own not-yet-closed tickets and may never change status or
  assignment. Agents/admins manage the rest.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException

from app.db.mongo import CATEGORIES, MESSAGES, TICKETS, USERS
from app.models.enums import ALLOWED_TRANSITIONS, TicketStatus
from app.services import audit, notifications
from app.utils.serialize import message_out, ticket_out

logger = logging.getLogger("ticket_api")

SORTABLE_FIELDS = {"created_at", "updated_at", "priority", "status"}


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_object_id(value: str, *, not_found_message: str = "Not found.") -> ObjectId:
    """Validate a client-supplied id; raise 404 on garbage so the shape
    stays consistent with truly-missing resources."""
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail=not_found_message)


async def visibility_filter(user: dict) -> dict:
    """Mongo filter fragment scoping tickets to what ``user`` may see."""
    role = user.get("role", "customer")
    uid = str(user["_id"])
    if role == "admin":
        return {}
    if role == "agent":
        return {
            "$or": [
                {"requester_id": uid},
                {"assignee_id": uid},
                {"assignee_id": None},
            ]
        }
    return {"requester_id": uid}


async def hydrate_tickets(db, docs: list[dict]) -> list[dict]:
    """Attach category/requester/assignee projections to ticket docs."""
    if not docs:
        return []
    category_ids: set[str] = {d["category_id"] for d in docs if d.get("category_id")}
    user_ids: set[str] = set()
    for d in docs:
        if d.get("requester_id"):
            user_ids.add(d["requester_id"])
        if d.get("assignee_id"):
            user_ids.add(d["assignee_id"])
        if d.get("resolved_by_id"):
            user_ids.add(d["resolved_by_id"])

    categories: dict[str, dict] = {}
    if category_ids:
        cursor = db[CATEGORIES].find({"_id": {"$in": [ObjectId(c) for c in category_ids]}})
        async for cat in cursor:
            categories[str(cat["_id"])] = cat

    users: dict[str, dict] = {}
    if user_ids:
        cursor = db[USERS].find(
            {"_id": {"$in": [ObjectId(u) for u in user_ids]}},
            {"name": 1, "email": 1, "role": 1},
        )
        async for u in cursor:
            users[str(u["_id"])] = u

    return [
        ticket_out(
            d,
            category=categories.get(d.get("category_id", "")),
            requester=users.get(d.get("requester_id", "")),
            assignee=users.get(d.get("assignee_id", "")),
            resolver=users.get(d.get("resolved_by_id", "")),
        )
        for d in docs
    ]


async def hydrate_ticket(db, doc: dict) -> dict:
    return (await hydrate_tickets(db, [doc]))[0]


async def get_ticket_or_404(db, ticket_id: str, user: dict) -> dict:
    """Fetch a ticket the user is allowed to see (404 otherwise).

    A ticket that exists but is invisible answers 404 (not 403) so the
    API doesn't leak the existence of other customers' tickets.
    """
    oid = parse_object_id(ticket_id, not_found_message="Ticket not found.")
    doc = await db[TICKETS].find_one({"_id": oid})
    if doc is None:
        raise HTTPException(status_code=404, detail="Ticket not found.")
    if not await user_can_access(db, doc, user):
        raise HTTPException(status_code=404, detail="Ticket not found.")
    return doc


async def user_can_access(db, ticket: dict, user: dict) -> bool:
    role = user.get("role", "customer")
    if role == "admin":
        return True
    uid = str(user["_id"])
    if ticket.get("requester_id") == uid:
        return True
    if role == "agent":
        return ticket.get("assignee_id") == uid or ticket.get("assignee_id") is None
    return False


async def list_tickets(
    db,
    user: dict,
    *,
    page: int,
    page_size: int,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    category_id: str | None = None,
    assignee_id: str | None = None,
    requester_id: str | None = None,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
) -> dict:
    flt: dict = await visibility_filter(user)

    if search:
        # Escape user input; search subject/description (+ exact ticket number).
        term = re.escape(search.strip())
        regex = {"$regex": term, "$options": "i"}
        or_clauses: list[dict] = [{"subject": regex}, {"description": regex}]
        if search.strip().isdigit():
            or_clauses.append({"ticket_number": int(search)})
        flt = {"$and": [flt, {"$or": or_clauses}]}
    if status:
        flt = {**flt, "status": status}
    if priority:
        flt = {**flt, "priority": priority}
    if category_id:
        flt = {**flt, "category_id": category_id}

    # assignee_id: ObjectId | "me" | "unassigned"
    if assignee_id == "me":
        flt = {**flt, "assignee_id": str(user["_id"])}
    elif assignee_id == "unassigned":
        flt = {**flt, "assignee_id": None}
    elif assignee_id:
        parse_object_id(assignee_id)
        flt = {**flt, "assignee_id": assignee_id}

    # requester_id: ObjectId | "me"
    if requester_id == "me":
        flt = {**flt, "requester_id": str(user["_id"])}
    elif requester_id:
        parse_object_id(requester_id)
        flt = {**flt, "requester_id": requester_id}

    total = await db[TICKETS].count_documents(flt)
    direction = 1 if sort_order == "asc" else -1
    skip = (page - 1) * page_size
    cursor = (
        db[TICKETS].find(flt).sort(sort_by, direction).skip(skip).limit(page_size)
    )
    docs = await cursor.to_list(length=page_size)
    items = await hydrate_tickets(db, docs)
    pages = max(1, -(-total // page_size)) if page_size else 1
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }


async def create_ticket(
    db, user: dict, payload: dict, *, ip_address: str | None = None
) -> dict:
    category_oid = parse_object_id(payload["category_id"], not_found_message="Category not found.")
    category = await db[CATEGORIES].find_one({"_id": category_oid})
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")
    if not category.get("is_active", True):
        raise HTTPException(
            status_code=400, detail="This category is no longer accepting tickets."
        )

    now = utcnow()
    counter = await db["counters"].find_one_and_update(
        {"_id": "ticket_number"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    ticket_number = counter["seq"] if counter else 1

    doc = {
        "ticket_number": ticket_number,
        "subject": payload["subject"],
        "description": payload["description"],
        "category_id": str(category_oid),
        "priority": payload["priority"],
        "status": TicketStatus.open.value,
        "requester_id": str(user["_id"]),
        "assignee_id": None,
        "created_at": now,
        "updated_at": now,
        "message_count": 0,
    }
    result = await db[TICKETS].insert_one(doc)
    doc["_id"] = result.inserted_id

    await audit.record(
        db,
        action=audit.ACTION_TICKET_CREATED,
        actor_id=str(user["_id"]),
        entity_type="ticket",
        entity_id=str(result.inserted_id),
        details=f"Ticket #{ticket_number} created",
        ip_address=ip_address,
    )
    # Notify the agent pool about the new queue item.
    pool = await notifications.agent_pool_ids(db)
    await notifications.create_for_many(
        db,
        user_ids=[uid for uid in pool if uid != str(user["_id"])],
        title=f"New ticket #{ticket_number}",
        body=payload["subject"],
        ticket_id=str(result.inserted_id),
    )
    return await hydrate_ticket(db, doc)


def _validate_transition(current: str, new: str) -> None:
    if current == new:
        return
    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if new not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change status from '{current}' to '{new}'.",
        )


async def update_ticket(
    db,
    user: dict,
    ticket: dict,
    payload: dict,
    *,
    ip_address: str | None = None,
) -> dict:
    role = user.get("role", "customer")
    uid = str(user["_id"])
    is_requester = ticket.get("requester_id") == uid

    if role == "customer":
        if not is_requester:
            raise HTTPException(status_code=404, detail="Ticket not found.")
        if ticket.get("status") in (TicketStatus.resolved.value, TicketStatus.closed.value):
            raise HTTPException(
                status_code=400,
                detail="This ticket is resolved or closed and can no longer be edited.",
            )
        if payload.get("status") is not None:
            raise HTTPException(
                status_code=403,
                detail="Only support staff can change the ticket status.",
            )

    updates: dict = {}
    changed_fields: list[str] = []

    for field in ("subject", "description", "priority"):
        value = payload.get(field)
        if value is not None and value != ticket.get(field):
            updates[field] = value
            changed_fields.append(field)

    if payload.get("category_id") and payload["category_id"] != ticket.get("category_id"):
        cat_oid = parse_object_id(payload["category_id"], not_found_message="Category not found.")
        category = await db[CATEGORIES].find_one({"_id": cat_oid})
        if category is None:
            raise HTTPException(status_code=404, detail="Category not found.")
        if not category.get("is_active", True) and role == "customer":
            raise HTTPException(
                status_code=400, detail="This category is no longer available."
            )
        updates["category_id"] = str(cat_oid)
        changed_fields.append("category")

    new_status = payload.get("status")
    if new_status is not None and new_status != ticket.get("status"):
        _validate_transition(ticket.get("status", "open"), new_status)
        updates["status"] = new_status
        changed_fields.append("status")

        was_done = ticket.get("status") in (
            TicketStatus.resolved.value,
            TicketStatus.closed.value,
        )
        is_done = new_status in (TicketStatus.resolved.value, TicketStatus.closed.value)
        if is_done and not was_done:
            # First time reaching a finished state: record WHO solved it.
            updates["resolved_by_id"] = uid
            updates["resolved_at"] = utcnow()
        elif not is_done and was_done:
            # Reopened — the previous resolution no longer stands.
            updates["resolved_by_id"] = None
            updates["resolved_at"] = None

    if not updates:
        return await hydrate_ticket(db, ticket)

    updates["updated_at"] = utcnow()
    await db[TICKETS].update_one({"_id": ticket["_id"]}, {"$set": updates})
    ticket = {**ticket, **updates}

    actor_label = "Customer" if role == "customer" else ("Agent" if role == "agent" else "Admin")
    await audit.record(
        db,
        action=audit.ACTION_TICKET_UPDATED,
        actor_id=uid,
        entity_type="ticket",
        entity_id=str(ticket["_id"]),
        details=f"{actor_label} updated: {', '.join(changed_fields)}",
        ip_address=ip_address,
    )

    if "status" in updates:
        await audit.record(
            db,
            action=audit.ACTION_TICKET_STATUS_CHANGED,
            actor_id=uid,
            entity_type="ticket",
            entity_id=str(ticket["_id"]),
            details=f"{ticket.get('status')} -> {updates['status']}",
            ip_address=ip_address,
        )
        # Notify the requester (unless they made the change).
        if ticket.get("requester_id") != uid:
            await notifications.create(
                db,
                user_id=ticket["requester_id"],
                title=f"Ticket #{ticket.get('ticket_number')} update",
                body=f"Your ticket '{ticket.get('subject')}' is now {updates['status'].replace('_', ' ')}.",
                ticket_id=str(ticket["_id"]),
            )

    return await hydrate_ticket(db, ticket)


async def assign_ticket(
    db,
    user: dict,
    ticket: dict,
    assignee_id: str | None,
    *,
    ip_address: str | None = None,
) -> dict:
    uid = str(user["_id"])
    if assignee_id:
        assignee_oid = parse_object_id(assignee_id, not_found_message="Assignee not found.")
        assignee = await db[USERS].find_one({"_id": assignee_oid})
        if assignee is None or assignee.get("role") not in ("agent", "admin"):
            raise HTTPException(
                status_code=400,
                detail="Tickets can only be assigned to agents or admins.",
            )
        if not assignee.get("is_active", True):
            raise HTTPException(status_code=400, detail="That user is deactivated.")

    now = utcnow()
    await db[TICKETS].update_one(
        {"_id": ticket["_id"]},
        {"$set": {"assignee_id": assignee_id, "updated_at": now}},
    )
    ticket = {**ticket, "assignee_id": assignee_id, "updated_at": now}

    await audit.record(
        db,
        action=audit.ACTION_TICKET_ASSIGNED if assignee_id else audit.ACTION_TICKET_UNASSIGNED,
        actor_id=uid,
        entity_type="ticket",
        entity_id=str(ticket["_id"]),
        details=f"Assignee set to {assignee_id or 'none'}",
        ip_address=ip_address,
    )
    if assignee_id and assignee_id != uid:
        await notifications.create(
            db,
            user_id=assignee_id,
            title=f"Ticket #{ticket.get('ticket_number')} assigned to you",
            body=ticket.get("subject"),
            ticket_id=str(ticket["_id"]),
        )
    return await hydrate_ticket(db, ticket)


async def add_message(
    db,
    user: dict,
    ticket: dict,
    *,
    body: str,
    visibility: str = "public",
    ip_address: str | None = None,
) -> dict:
    """Post a reply/note and return the refreshed conversation."""
    role = user.get("role", "customer")
    uid = str(user["_id"])

    if visibility == "internal" and role == "customer":
        raise HTTPException(
            status_code=403,
            detail="Customers cannot add internal notes.",
        )

    now = utcnow()
    message_doc = {
        "ticket_id": str(ticket["_id"]),
        "author_id": uid,
        "body": body,
        "visibility": visibility,
        "created_at": now,
    }
    result = await db[MESSAGES].insert_one(message_doc)
    message_doc["_id"] = result.inserted_id

    await db[TICKETS].update_one(
        {"_id": ticket["_id"]},
        {"$inc": {"message_count": 1}, "$set": {"updated_at": now}},
    )
    ticket = {**ticket, "message_count": ticket.get("message_count", 0) + 1, "updated_at": now}

    await audit.record(
        db,
        action=audit.ACTION_MESSAGE_ADDED,
        actor_id=uid,
        entity_type="ticket",
        entity_id=str(ticket["_id"]),
        details=f"{role} added a {visibility} message",
        ip_address=ip_address,
    )

    if visibility == "public":
        recipients: list[str] = []
        if ticket.get("requester_id") and ticket["requester_id"] != uid:
            recipients.append(ticket["requester_id"])
        if ticket.get("assignee_id") and ticket["assignee_id"] != uid:
            recipients.append(ticket["assignee_id"])
        # Staff replies notify the requester; customer replies notify staff.
        if role == "customer":
            pool = await notifications.agent_pool_ids(db)
            recipients.extend(uid_ for uid_ in pool if uid_ != uid)
        await notifications.create_for_many(
            db,
            user_ids=recipients,
            title=f"New reply on ticket #{ticket.get('ticket_number')}",
            body=body[:140],
            ticket_id=str(ticket["_id"]),
        )

    return await get_conversation(db, ticket, viewer=user)


async def get_conversation(db, ticket: dict, *, viewer: dict) -> dict:
    """Ticket + messages the viewer is allowed to see (internal notes
    are stripped for customers), in chronological order."""
    ticket_id = str(ticket["_id"])
    flt: dict = {"ticket_id": ticket_id}
    if viewer.get("role", "customer") == "customer":
        flt["visibility"] = "public"

    cursor = db[MESSAGES].find(flt).sort("created_at", 1)
    docs = await cursor.to_list(length=None)

    author_ids = {d["author_id"] for d in docs if d.get("author_id")}
    authors: dict[str, dict] = {}
    if author_ids:
        user_cursor = db[USERS].find(
            {"_id": {"$in": [ObjectId(a) for a in author_ids]}},
            {"name": 1, "email": 1, "role": 1},
        )
        async for u in user_cursor:
            authors[str(u["_id"])] = u

    messages = [message_out(d, author=authors.get(d.get("author_id", ""))) for d in docs]
    return {"ticket": await hydrate_ticket(db, ticket), "messages": messages}
