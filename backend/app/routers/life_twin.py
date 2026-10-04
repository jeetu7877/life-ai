import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user
from app.services.life_twin_service import life_twin_service

logger = logging.getLogger("life.router.life_twin")
router = APIRouter(prefix="/life-twin", tags=["Life Twin"])

@router.get("", response_model=Dict[str, Any])
def get_current_life_twin(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch structured Life Twin analytical model of the user's current situation."""
    return life_twin_service.compute_current_state(db, user.id)

@router.post("/snapshot")
def create_life_twin_snapshot(
    snapshot_date: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create an immutable snapshot of current state."""
    snapshot = life_twin_service.create_immutable_snapshot(db, user.id, snapshot_date)
    return {
        "id": snapshot.id,
        "snapshot_date": snapshot.snapshot_date,
        "is_current": snapshot.is_current,
        "created_at": snapshot.created_at.isoformat()
    }

@router.get("/compare")
def compare_life_twin_snapshots(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Compare current Life Twin state against previous snapshot (Added, Removed, Improved, Declined)."""
    return life_twin_service.compare_snapshots(db, user.id)
