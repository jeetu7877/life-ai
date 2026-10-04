from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user
from app.services.goal_service import goal_service

router = APIRouter(prefix="/goals", tags=["Goals & Milestones"])

class GoalCreateRequest(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = "career"
    priority: Optional[int] = 1
    target_period_months: Optional[int] = 3

class MilestoneStatusRequest(BaseModel):
    status: str  # in_progress, completed, skipped

@router.get("")
def list_goals(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch user's goals with milestones."""
    goals = goal_service.get_user_goals(db, user.id, status)
    result = []
    for g in goals:
        result.append({
            "id": g.id,
            "title": g.title,
            "description": g.description,
            "category": g.category,
            "priority": g.priority,
            "status": g.status,
            "progress": g.progress,
            "deadline": g.deadline.isoformat() if g.deadline else None,
            "target_period": g.target_period,
            "created_at": g.created_at.isoformat() if g.created_at else None,
            "milestones": [
                {
                    "id": m.id,
                    "title": m.title,
                    "order_index": m.order_index,
                    "status": m.status,
                    "deadline": m.deadline.isoformat() if m.deadline else None
                }
                for m in g.milestones
            ]
        })
    return result

@router.post("")
def create_goal(
    payload: GoalCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new goal and automatically generate standard milestones and tasks."""
    g = goal_service.create_goal_with_roadmap(
        db=db,
        user_id=user.id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        priority=payload.priority,
        target_period_months=payload.target_period_months
    )
    return {
        "id": g.id,
        "title": g.title,
        "category": g.category,
        "status": g.status,
        "progress": g.progress,
        "milestones_count": len(g.milestones)
    }

@router.get("/recommendation")
def get_goal_recommendation(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Answers 'What should I do today?' / 'What is the next step for my goal?'"""
    return goal_service.get_next_recommended_step(db, user.id)

@router.post("/milestones/{milestone_id}/status")
def update_milestone_status(
    milestone_id: str,
    payload: MilestoneStatusRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update milestone status and re-calculate goal progress percentage."""
    m = goal_service.update_milestone_status(db, user.id, milestone_id, payload.status)
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return {"id": m.id, "status": m.status, "goal_id": m.goal_id}
