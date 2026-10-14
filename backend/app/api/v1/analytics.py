"""Analytics routes. Overview is role-scoped; agent workloads are admin-only."""

from fastapi import APIRouter, Depends

from app.db.mongo import get_db
from app.dependencies.auth import get_current_user, require_admin
from app.models.admin import AgentWorkloadOut, AnalyticsOverviewOut
from app.services import analytics as analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get(
    "/overview",
    response_model=AnalyticsOverviewOut,
    summary="Aggregate metrics (role-scoped)",
)
async def overview(
    db=Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    return await analytics_service.overview(db, user)


@router.get(
    "/agents",
    response_model=list[AgentWorkloadOut],
    summary="Per-agent workload (admin)",
)
async def agent_workloads(
    db=Depends(get_db),
    _: dict = Depends(require_admin),
) -> list[dict]:
    return await analytics_service.agent_workloads(db)
