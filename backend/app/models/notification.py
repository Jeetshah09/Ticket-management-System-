"""Notification models."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.models.common import Page


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str | None = None
    ticket_id: str | None = None
    is_read: bool = False
    created_at: datetime


class NotificationPage(Page[NotificationOut]):
    """List envelope plus a convenience unread counter for the bell."""

    unread_count: int = 0
