from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user
from app.services.analytics_service import analytics_service
from app.services.daily_brief_service import daily_brief_service

router = APIRouter(prefix="/analytics", tags=["Productivity Analytics & Briefs"])

class EventLogRequest(BaseModel):
    category: str
    title: str
    duration_minutes: Optional[int] = 0
    project_tag: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None

@router.get("/metrics")
def get_productivity_metrics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch Today, This Week, and This Month productivity analytics."""
    return analytics_service.get_aggregated_metrics(db, user.id)

@router.post("/event")
def log_productivity_event(
    payload: EventLogRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Log genuine user activity event (study, coding, project, task, application)."""
    evt = analytics_service.log_event(
        db=db,
        user_id=user.id,
        category=payload.category,
        title=payload.title,
        duration_minutes=payload.duration_minutes or 0,
        project_tag=payload.project_tag,
        metadata_json=payload.metadata_json or {}
    )
    return {"id": evt.id, "category": evt.category, "title": evt.title}

@router.get("/brief")
def get_daily_brief(
    brief_type: Optional[str] = "morning",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Generate or fetch today's Daily AI Brief."""
    brief = daily_brief_service.generate_brief(
        db=db,
        user_id=user.id,
        user_name=user.full_name or user.username,
        brief_type=brief_type or "morning"
    )
    return {
        "id": brief.id,
        "brief_type": brief.brief_type,
        "brief_date": brief.brief_date,
        "summary_yesterday": brief.summary_yesterday,
        "priorities_today": brief.priorities_today,
        "urgent_deadlines": brief.urgent_deadlines,
        "recommendation": brief.recommendation
    }
