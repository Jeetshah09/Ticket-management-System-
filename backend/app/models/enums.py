"""Domain enums — the single source of truth for the API.

These values MUST match the frontend's TypeScript unions exactly
(frontend/types/ticket.ts and frontend/types/auth.ts):

    status:     open | in_progress | pending | resolved | closed
    priority:   low | medium | high | urgent
    visibility: public | internal
    role:       customer | agent | admin
"""

from enum import Enum


class Role(str, Enum):
    customer = "customer"
    agent = "agent"
    admin = "admin"


class TicketStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    pending = "pending"
    resolved = "resolved"
    closed = "closed"


class TicketPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class MessageVisibility(str, Enum):
    public = "public"
    internal = "internal"


# Human-readable labels (used by analytics buckets; the frontend keeps
# its own display labels, these exist so API consumers see real words).
STATUS_LABELS: dict[str, str] = {
    "open": "Open",
    "in_progress": "In Progress",
    "pending": "Pending",
    "resolved": "Resolved",
    "closed": "Closed",
}

PRIORITY_LABELS: dict[str, str] = {
    "low": "Low",
    "medium": "Medium",
    "high": "High",
    "urgent": "Urgent",
}

STATUS_ORDER: list[str] = [s.value for s in TicketStatus]
PRIORITY_ORDER: list[str] = [p.value for p in TicketPriority]

# Rank maps used for meaningful (non-alphabetical) sorting.
STATUS_RANK: dict[str, int] = {s: i for i, s in enumerate(STATUS_ORDER)}
PRIORITY_RANK: dict[str, int] = {p: i for i, p in enumerate(PRIORITY_ORDER)}

# Allowed status transitions (validated server-side).
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "open": {"in_progress", "pending", "resolved", "closed"},
    "in_progress": {"open", "pending", "resolved", "closed"},
    "pending": {"open", "in_progress", "resolved", "closed"},
    "resolved": {"closed", "open", "in_progress"},
    "closed": {"open"},  # reopen
}

# Statuses counted as "still being worked on".
ACTIVE_STATUSES: list[str] = ["open", "in_progress", "pending"]
# Statuses counted as "completed work" for dashboard metrics.
DONE_STATUSES: list[str] = ["resolved", "closed"]
