from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user
from app.services.proactive_service import proactive_service

router = APIRouter(prefix="/proactive", tags=["Proactive AI & Insights"])

class ProactiveSettingsUpdateRequest(BaseModel):
    is_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    min_importance: Optional[int] = None
    max_suggestions_per_day: Optional[int] = None

@router.get("/insights")
def get_proactive_insights(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Scan and fetch non-spammy proactive suggestions."""
    insights = proactive_service.scan_for_insights(db, user.id)
    return [
        {
            "id": ins.id,
            "insight_type": ins.insight_type,
            "title": ins.title,
            "reason": ins.reason,
            "importance": ins.importance,
            "source": ins.source,
            "action_label": ins.action_label,
            "action_payload": ins.action_payload,
            "created_at": ins.created_at.isoformat() if ins.created_at else None
        }
        for ins in insights
    ]

@router.post("/insights/{insight_id}/dismiss")
def dismiss_insight(
    insight_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """User dismisses an insight."""
    success = proactive_service.dismiss_insight(db, user.id, insight_id)
    if not success:
        raise HTTPException(status_code=404, detail="Insight not found")
    return {"status": "dismissed"}

@router.get("/settings")
def get_proactive_settings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch user proactive controls."""
    s = proactive_service.get_or_create_settings(db, user.id)
    return {
        "is_enabled": s.is_enabled,
        "quiet_hours_start": s.quiet_hours_start,
        "quiet_hours_end": s.quiet_hours_end,
        "min_importance": s.min_importance,
        "max_suggestions_per_day": s.max_suggestions_per_day
    }

@router.put("/settings")
def update_proactive_settings(
    payload: ProactiveSettingsUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update user proactive controls."""
    s = proactive_service.get_or_create_settings(db, user.id)
    if payload.is_enabled is not None:
        s.is_enabled = payload.is_enabled
    if payload.quiet_hours_start is not None:
        s.quiet_hours_start = payload.quiet_hours_start
    if payload.quiet_hours_end is not None:
        s.quiet_hours_end = payload.quiet_hours_end
    if payload.min_importance is not None:
        s.min_importance = payload.min_importance
    if payload.max_suggestions_per_day is not None:
        s.max_suggestions_per_day = payload.max_suggestions_per_day
    db.commit()
    return {"status": "updated"}
