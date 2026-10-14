"""Health/readiness endpoints. No sensitive diagnostics are exposed."""

from fastapi import APIRouter, Depends, Response, status

from app.db.mongo import get_db
from app.models.admin import HealthOut

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthOut,
    summary="Liveness/readiness probe",
)
async def health(response: Response, db=Depends(get_db)) -> dict:
    """Returns 200 with database:"ok" when MongoDB answers a ping,
    503 otherwise. Never exposes configuration or diagnostics."""
    try:
        await db.command("ping")
        return {"status": "ok", "database": "ok"}
    except Exception:  # noqa: BLE001 — degrade to 503 without details
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "degraded", "database": "unavailable"}
