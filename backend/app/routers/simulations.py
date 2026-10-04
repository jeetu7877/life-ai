import logging
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user
from app.services.what_if_simulator import what_if_simulator
from app.services.decision_debate_service import decision_debate_service
from app.services.bottleneck_engine import bottleneck_engine

logger = logging.getLogger("life.router.simulations")
router = APIRouter(prefix="/simulations", tags=["Simulations & Decision Engine"])

class WhatIfRequest(BaseModel):
    query: str = Field(description="Scenario question, e.g., 'What if I study DSA 2 hours every day for 30 days?'")

class DecisionDebateRequest(BaseModel):
    query: str = Field(description="Decision options to evaluate, e.g., 'Should I focus on DSA or projects?'")

@router.post("/what-if")
def run_what_if_simulation(
    payload: WhatIfRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Run What-If scenario simulation with trade-offs, consistency requirements, and estimated outcomes."""
    return what_if_simulator.simulate(db, user.id, payload.query)

@router.post("/decision-debate")
def run_decision_debate(
    payload: DecisionDebateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Run dual-perspective decision debate with grounded recommendations."""
    return decision_debate_service.debate(db, user.id, payload.query)

@router.get("/bottlenecks")
def get_bottleneck_diagnosis(
    area: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Diagnose execution bottlenecks ('Why am I stuck?')."""
    return bottleneck_engine.analyze_bottleneck(db, user.id, area)
