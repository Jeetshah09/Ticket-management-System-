"""Ticket request/response models."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.auth import UserSummaryOut
from app.models.common import ApiModel
from app.models.enums import MessageVisibility, TicketPriority, TicketStatus

OBJECT_ID_PATTERN = r"^[0-9a-fA-F]{24}$"


def _require_object_id(value: str) -> str:
    import re

    if not re.match(OBJECT_ID_PATTERN, value):
        raise ValueError("Invalid id format.")
    return value.lower()


class CreateTicketRequest(ApiModel):
    subject: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=10000)
    category_id: str
    priority: TicketPriority

    @field_validator("subject")
    @classmethod
    def strip_subject(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Subject is required.")
        return v

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Description is required.")
        return v

    @field_validator("category_id")
    @classmethod
    def valid_category_id(cls, v: str) -> str:
        return _require_object_id(v)


class UpdateTicketRequest(ApiModel):
    subject: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, min_length=1, max_length=10000)
    category_id: str | None = None
    priority: TicketPriority | None = None
    status: TicketStatus | None = None

    @field_validator("category_id")
    @classmethod
    def valid_category_id(cls, v: str | None) -> str | None:
        return _require_object_id(v) if v else v

    @model_validator(mode="after")
    def at_least_one_field(self):
        if not any(v is not None for v in self.model_dump().values()):
            raise ValueError("Provide at least one field to update.")
        return self


class CreateMessageRequest(ApiModel):
    body: str = Field(min_length=1, max_length=10000)
    visibility: MessageVisibility = MessageVisibility.public

    @field_validator("body")
    @classmethod
    def strip_body(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message body is required.")
        return v


class AssignTicketRequest(ApiModel):
    # None (JSON null) unassigns the ticket.
    assignee_id: str | None = None

    @field_validator("assignee_id")
    @classmethod
    def valid_assignee_id(cls, v: str | None) -> str | None:
        return _require_object_id(v) if v else v


class TicketListParams(ApiModel):
    """Query parameters for GET /tickets."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    search: str | None = Field(default=None, max_length=200)
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    category_id: str | None = None
    assignee_id: str | None = None  # ObjectId, "me" or "unassigned"
    requester_id: str | None = None  # ObjectId or "me"
    sort_by: str = "updated_at"  # created_at|updated_at|priority|status
    sort_order: str = "desc"  # asc|desc

    @field_validator("category_id", "requester_id")
    @classmethod
    def valid_id(cls, v: str | None) -> str | None:
        return _require_object_id(v) if v else v

    @field_validator("sort_by")
    @classmethod
    def valid_sort_by(cls, v: str) -> str:
        allowed = {"created_at", "updated_at", "priority", "status"}
        if v not in allowed:
            raise ValueError(f"sort_by must be one of: {', '.join(sorted(allowed))}")
        return v

    @field_validator("sort_order")
    @classmethod
    def valid_sort_order(cls, v: str) -> str:
        if v not in {"asc", "desc"}:
            raise ValueError("sort_order must be 'asc' or 'desc'.")
        return v


# ------------------------------- responses --------------------------------


class CategoryBriefOut(BaseModel):
    id: str
    name: str
    description: str | None = None
    is_active: bool = True


class TicketOut(BaseModel):
    id: str
    ticket_number: int | None = None
    subject: str
    description: str
    status: TicketStatus
    priority: TicketPriority
    category: CategoryBriefOut | None = None
    category_id: str | None = None
    requester: UserSummaryOut | None = None
    assignee: UserSummaryOut | None = None
    resolved_by: UserSummaryOut | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class TicketMessageOut(BaseModel):
    id: str
    ticket_id: str
    author: UserSummaryOut
    body: str
    visibility: MessageVisibility
    created_at: datetime


class TicketConversationOut(BaseModel):
    """Shape returned by GET /tickets/{id} and POST /messages."""

    ticket: TicketOut
    messages: list[TicketMessageOut] = []
