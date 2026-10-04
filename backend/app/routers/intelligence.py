import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user
from app.services.project_health_service import project_health_service
from app.services.risk_detector_service import risk_detector_service
from app.services.pattern_detector_service import pattern_detector_service
from app.services.memory_detective_service import memory_detective_service

logger = logging.getLogger("life.router.intelligence")
router = APIRouter(prefix="/intelligence", tags=["Intelligence Suite"])

@router.get("/project-health")
def get_project_health(
    repo_name: Optional[str] = Query("Life AI", description="Repository name"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch explainable 5-dimension project health score and evidence."""
    return project_health_service.analyze_repo_health(db, user.id, repo_name)

@router.get("/risks")
def get_detected_risks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve personal risks (deadlines approaching, consistency gaps)."""
    return risk_detector_service.scan_risks(db, user.id)

@router.get("/patterns")
def get_detected_patterns(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve observable recurring behavioral patterns."""
    return pattern_detector_service.detect_patterns(db, user.id)

@router.get("/memory-conflicts")
def get_memory_conflicts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Scan and retrieve conflicting or duplicate memories."""
    return memory_detective_service.scan_conflicts(db, user.id)
