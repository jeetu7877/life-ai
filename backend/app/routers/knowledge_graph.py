from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Any, List

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user
from app.services.knowledge_graph_service import knowledge_graph_service

router = APIRouter(prefix="/knowledge-graph", tags=["Knowledge Graph"])

@router.get("", response_model=Dict[str, Any])
def get_user_knowledge_graph(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch user's personal knowledge graph nodes and relationship edges."""
    return knowledge_graph_service.get_user_knowledge_subgraph(db, user.id)

@router.get("/entity/{name}", response_model=List[Dict[str, Any]])
def get_entity_relationships(
    name: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Fetch all outgoing and incoming relationships for a specific entity."""
    return knowledge_graph_service.query_relationships_for_entity(db, user.id, name)
