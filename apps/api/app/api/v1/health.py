from fastapi import APIRouter, HTTPException

from app import __version__
from app.core.config import get_settings
from app.db.session import check_database

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness probe: the process is up. Does not touch the database."""
    return {
        "status": "ok",
        "service": "eskanban-api",
        "version": __version__,
        "env": get_settings().env,
    }


@router.get("/health/ready")
def ready() -> dict[str, str]:
    """Readiness probe: the database is reachable."""
    if not check_database():
        raise HTTPException(status_code=503, detail="database unavailable")
    return {"status": "ready", "database": "ok"}
