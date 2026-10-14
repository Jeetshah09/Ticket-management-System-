"""Admin-domain models: users, audit logs, analytics."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.auth import UserOut, UserSummaryOut
from app.models.common import ApiModel
from app.models.enums import Role


# --------------------------------- users ----------------------------------


class UpdateUserRequest(ApiModel):
    role: Role | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def at_least_one_field(self):
        if self.role is None and self.is_active is None:
            raise ValueError("Provide a role or is_active to update.")
        return self


# ------------------------------- audit logs -------------------------------


class AuditLogOut(BaseModel):
    id: str
    action: str
    actor: UserSummaryOut | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    details: str | None = None
    ip_address: str | None = None
    created_at: datetime


# -------------------------------- analytics -------------------------------


class MetricBucket(BaseModel):
    key: str
    label: str
    count: int


class TrendPoint(BaseModel):
    date: str
    count: int


class AnalyticsOverviewOut(BaseModel):
    total_tickets: int
    open_tickets: int
    resolved_tickets: int = 0
    # Admin-only fields are omitted (None) for other roles.
    unassigned_tickets: int | None = None
    total_users: int | None = None
    total_categories: int | None = None
    by_status: list[MetricBucket] = []
    by_priority: list[MetricBucket] = []
    by_category: list[MetricBucket] = []
    created_trend: list[TrendPoint] = []


class AgentWorkloadOut(BaseModel):
    agent: UserSummaryOut
    open_tickets: int
    total_tickets: int


class HealthOut(BaseModel):
    status: str = Field(examples=["ok"])
    database: str | None = Field(default=None, examples=["ok"])
