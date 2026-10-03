from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class MemoryCreate(BaseModel):
    content: str
    memory_type: str = Field(..., description="skill, preference, project, goal, etc.")
    importance: int = Field(default=3, ge=1, le=5)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    event_date: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None

class MemoryUpdate(BaseModel):
    content: Optional[str] = None
    memory_type: Optional[str] = None
    importance: Optional[int] = Field(default=None, ge=1, le=5)
    confidence: Optional[float] = None
    status: Optional[str] = None  # active, superseded, archived
    event_date: Optional[str] = None

class MemoryResponse(BaseModel):
    id: str
    user_id: str
    content: str
    memory_type: str
    importance: int
    confidence: float
    status: str
    event_date: Optional[str] = None
    source_conversation_id: Optional[str] = None
    last_confirmed_at: datetime
    superseded_by_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MemorySearchQuery(BaseModel):
    query: str
    memory_type: Optional[str] = None
    limit: int = 5
