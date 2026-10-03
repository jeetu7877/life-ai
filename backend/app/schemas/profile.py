from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    preferred_name: Optional[str] = None
    education: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    skills: Optional[List[str]] = None
    programming_languages: Optional[List[str]] = None
    frameworks: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    projects: Optional[List[Any]] = None
    interests: Optional[List[str]] = None
    goals: Optional[List[str]] = None
    preferences: Optional[Dict[str, Any]] = None
    current_focus: Optional[str] = None
    achievements: Optional[List[str]] = None
    important_dates: Optional[Dict[str, str]] = None

class ProfileResponse(BaseModel):
    id: str
    user_id: str
    name: Optional[str] = None
    preferred_name: Optional[str] = None
    education: Optional[str] = None
    college: Optional[str] = None
    degree: Optional[str] = None
    branch: Optional[str] = None
    skills: List[str] = []
    programming_languages: List[str] = []
    frameworks: List[str] = []
    tools: List[str] = []
    projects: List[Any] = []
    interests: List[str] = []
    goals: List[str] = []
    preferences: Dict[str, Any] = {}
    current_focus: Optional[str] = None
    achievements: List[str] = []
    important_dates: Dict[str, str] = {}
    updated_at: datetime

    class Config:
        from_attributes = True
