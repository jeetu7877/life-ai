from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class DailyActivityCreate(BaseModel):
    activity_date: str  # YYYY-MM-DD
    activity_time: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: str = "work"
    project_tag: Optional[str] = None

class DailyActivityResponse(BaseModel):
    id: str
    user_id: str
    activity_date: str
    activity_time: Optional[str] = None
    title: str
    description: Optional[str] = None
    category: str
    project_tag: Optional[str] = None
    source_message_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
