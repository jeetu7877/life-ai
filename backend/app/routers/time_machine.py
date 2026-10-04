import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user
from app.services.time_machine_service import time_machine_service
from app.services.weekly_reflection_service import weekly_reflection_service

logger = logging.getLogger("life.router.time_machine")
router = APIRouter(prefix="/time-machine", tags=["Time Machine & Reflection"])

@router.get("/query")
def query_time_machine(
    date_query: str = Query(..., description="Target date or phrase like 'one month ago' or '2026-09-01'"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Reconstruct historical user activity, goals, and state."""
    return time_machine_service.reconstruct_time_period(db, user.id, date_query)

@router.get("/weekly-reflection")
def get_weekly_reflection(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Generate structured weekly life reflection across past 7 days."""
    return weekly_reflection_service.generate_reflection(db, user.id)
