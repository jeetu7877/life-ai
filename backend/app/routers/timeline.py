from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.timeline import DailyActivity
from app.schemas.timeline import DailyActivityCreate, DailyActivityResponse
from app.security.dependencies import get_optional_user

router = APIRouter(prefix="/timeline", tags=["Daily Timeline"])

@router.get("", response_model=List[DailyActivityResponse])
def get_timeline(
    date: Optional[str] = Query(None, description="Filter by YYYY-MM-DD"),
    project_tag: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    query = db.query(DailyActivity).filter(DailyActivity.user_id == user.id)
    if date:
        query = query.filter(DailyActivity.activity_date == date)
    if project_tag:
        query = query.filter(DailyActivity.project_tag == project_tag)
    if category:
        query = query.filter(DailyActivity.category == category)
        
    return query.order_by(DailyActivity.activity_date.desc(), DailyActivity.activity_time.desc()).all()

@router.post("", response_model=DailyActivityResponse)
def add_activity(
    activity_in: DailyActivityCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    act = DailyActivity(
        user_id=user.id,
        activity_date=activity_in.activity_date,
        activity_time=activity_in.activity_time or datetime.utcnow().strftime("%I:%M %p"),
        title=activity_in.title,
        description=activity_in.description,
        category=activity_in.category,
        project_tag=activity_in.project_tag
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    return act

@router.delete("/{act_id}")
def delete_activity(
    act_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    act = db.query(DailyActivity).filter(
        DailyActivity.id == act_id,
        DailyActivity.user_id == user.id
    ).first()
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")
    db.delete(act)
    db.commit()
    return {"status": "deleted", "id": act_id}
