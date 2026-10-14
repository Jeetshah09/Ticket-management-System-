"""Ticket routes: role-scoped list/create/detail/update, messages, assign.

All authorization is enforced here (and in ``app.services.tickets``);
customers can never see other customers' tickets or internal notes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.db.mongo import get_db
from app.dependencies.auth import get_current_user
from app.models.common import Page
from app.models.enums import MessageVisibility, TicketPriority, TicketStatus
from app.models.ticket import (
    AssignTicketRequest,
    CreateMessageRequest,
    CreateTicketRequest,
    TicketConversationOut,
    TicketOut,
    UpdateTicketRequest,
)
from app.services import tickets as ticket_service

router = APIRouter(prefix="/tickets", tags=["tickets"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


@router.get("", response_model=Page[TicketOut], summary="List tickets (role-scoped)")
async def list_tickets(
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=200),
    status: TicketStatus | None = Query(None),
    priority: TicketPriority | None = Query(None),
    category_id: str | None = Query(None),
    assignee_id: str | None = Query(None, description="ObjectId, 'me' or 'unassigned'"),
    requester_id: str | None = Query(None, description="ObjectId or 'me'"),
    sort_by: str = Query("updated_at", pattern="^(created_at|updated_at|priority|status)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
) -> dict:
    return await ticket_service.list_tickets(
        db,
        user,
        page=page,
        page_size=page_size,
        search=search,
        status=status.value if status else None,
        priority=priority.value if priority else None,
        category_id=category_id,
        assignee_id=assignee_id,
        requester_id=requester_id,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.post(
    "",
    response_model=TicketOut,
    status_code=201,
    summary="Create a ticket (requester = authenticated user)",
)
async def create_ticket(
    payload: CreateTicketRequest,
    request: Request,
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    return await ticket_service.create_ticket(
        db, user, payload.model_dump(), ip_address=_client_ip(request)
    )


@router.get(
    "/{ticket_id}",
    response_model=TicketConversationOut,
    summary="Ticket detail + conversation",
)
async def get_ticket(
    ticket_id: str,
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    doc = await ticket_service.get_ticket_or_404(db, ticket_id, user)
    return await ticket_service.get_conversation(db, doc, viewer=user)


@router.patch("/{ticket_id}", response_model=TicketOut, summary="Update ticket fields/status")
async def update_ticket(
    ticket_id: str,
    payload: UpdateTicketRequest,
    request: Request,
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    doc = await ticket_service.get_ticket_or_404(db, ticket_id, user)
    return await ticket_service.update_ticket(
        db,
        user,
        doc,
        payload.model_dump(exclude_unset=True),
        ip_address=_client_ip(request),
    )


@router.post(
    "/{ticket_id}/messages",
    response_model=TicketConversationOut,
    status_code=201,
    summary="Add a public reply or internal note",
)
async def add_message(
    ticket_id: str,
    payload: CreateMessageRequest,
    request: Request,
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    doc = await ticket_service.get_ticket_or_404(db, ticket_id, user)
    return await ticket_service.add_message(
        db,
        user,
        doc,
        body=payload.body,
        visibility=payload.visibility.value,
        ip_address=_client_ip(request),
    )


@router.post(
    "/{ticket_id}/assign",
    response_model=TicketOut,
    summary="Assign/unassign (agent/admin only, enforced server-side)",
)
async def assign_ticket(
    ticket_id: str,
    payload: AssignTicketRequest,
    request: Request,
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    if user.get("role") not in ("agent", "admin"):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to perform this action.",
        )
    doc = await ticket_service.get_ticket_or_404(db, ticket_id, user)
    return await ticket_service.assign_ticket(
        db, user, doc, payload.assignee_id, ip_address=_client_ip(request)
    )
