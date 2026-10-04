import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user
from app.services.journal_service import journal_service

logger = logging.getLogger("life.router.journal")
router = APIRouter(prefix="/journal", tags=["Personal Journal"])

class JournalCreateRequest(BaseModel):
    content: str = Field(description="Journal reflection text")
    title: Optional[str] = Field(default=None, description="Optional title")
    category: Optional[str] = Field(default="private_journal", description="private_journal, important_memory, goal, lesson, event")
    entry_date: Optional[str] = Field(default=None, description="YYYY-MM-DD")

@router.get("")
def list_journal_entries(
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """List recent journal reflections."""
    entries = journal_service.list_entries(db, user.id, limit)
    return [{
        "id": e.id,
        "entry_date": e.entry_date,
        "title": e.title,
        "content": e.content,
        "category": e.category,
        "extracted_insights": e.extracted_insights,
        "is_promoted_to_memory": e.is_promoted_to_memory,
        "created_at": e.created_at.isoformat()
    } for e in entries]

@router.post("")
def create_journal_entry(
    payload: JournalCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new journal entry with automatic lesson/goal extraction."""
    entry = journal_service.create_entry(
        db=db,
        user_id=user.id,
        content=payload.content,
        title=payload.title,
        category=payload.category or "private_journal",
        entry_date=payload.entry_date
    )
    return {
        "id": entry.id,
        "entry_date": entry.entry_date,
        "title": entry.title,
        "category": entry.category,
        "extracted_insights": entry.extracted_insights,
        "is_promoted_to_memory": entry.is_promoted_to_memory
    }

@router.post("/{entry_id}/promote")
def promote_entry_to_memory(
    entry_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """User-controlled promotion of a journal entry to permanent memory."""
    mem = journal_service.promote_to_memory(db, user.id, entry_id)
    if not mem:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return {
        "success": True,
        "memory_id": mem.id,
        "message": "Journal entry successfully promoted to permanent long-term memory."
    }
