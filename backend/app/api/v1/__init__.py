"""API v1 router aggregation. Mounted at /api/v1 by app.main."""

from fastapi import APIRouter

from app.api.v1 import (
    analytics,
    audit_logs,
    auth,
    categories,
    health,
    notifications,
    tickets,
    users,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(tickets.router)
api_router.include_router(categories.router)
api_router.include_router(notifications.router)
api_router.include_router(analytics.router)
api_router.include_router(audit_logs.router)
