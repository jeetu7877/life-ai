from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.study import StudySubject
from app.security.dependencies import get_current_user
from app.services.study_coach_service import study_coach_service

router = APIRouter(prefix="/study", tags=["AI Study Coach"])

class RoadmapRequest(BaseModel):
    subject_name: str
    category: Optional[str] = "computer_science"

class StudySessionRequest(BaseModel):
    subject_name: str
    duration_minutes: int
    topics: List[str]
    mistakes: Optional[List[str]] = None
    notes: Optional[str] = None

@router.get("/subjects")
def list_study_subjects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch all study roadmaps and subjects for user."""
    subjects = db.query(StudySubject).filter(StudySubject.user_id == user.id).all()
    result = []
    for s in subjects:
        result.append({
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "overall_progress": s.overall_progress,
            "confidence_level": s.confidence_level,
            "topics": [
                {
                    "id": t.id,
                    "name": t.name,
                    "status": t.status,
                    "mastery_score": t.mastery_score,
                    "is_weak_spot": t.is_weak_spot,
                    "weakness_reason": t.weakness_reason
                }
                for t in s.topics
            ]
        })
    return result

@router.post("/roadmap")
def create_roadmap(
    payload: RoadmapRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Generate or retrieve a structured learning roadmap for a subject."""
    subj = study_coach_service.create_subject_with_roadmap(
        db=db,
        user_id=user.id,
        subject_name=payload.subject_name,
        category=payload.category
    )
    return {
        "id": subj.id,
        "name": subj.name,
        "overall_progress": subj.overall_progress,
        "topics_count": len(subj.topics)
    }

@router.get("/weak-topics")
def get_weak_topics(
    subject: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Returns detected weak study areas and mistakes."""
    return study_coach_service.get_weak_topics(db, user.id, subject)

@router.post("/session")
def log_study_session(
    payload: StudySessionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Log a completed study session and record identified mistakes."""
    sess = study_coach_service.log_study_session(
        db=db,
        user_id=user.id,
        subject_name=payload.subject_name,
        duration_minutes=payload.duration_minutes,
        topics=payload.topics,
        mistakes=payload.mistakes,
        notes=payload.notes
    )
    return {"id": sess.id, "subject_id": sess.subject_id, "duration": sess.duration_minutes}
