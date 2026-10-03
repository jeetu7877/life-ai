from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class MessageCreate(BaseModel):
    conversation_id: Optional[str] = None
    content: str
    timezone: Optional[str] = "Asia/Kolkata"
    audio_base64: Optional[str] = None
    voice_mode: Optional[bool] = False

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    audio_url: Optional[str] = None
    timestamp: datetime
    timezone: str
    local_time_str: Optional[str] = None
    metadata_json: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: str
    user_id: str
    title: str
    created_at: datetime
    updated_at: datetime
    messages: Optional[List[MessageResponse]] = []

    class Config:
        from_attributes = True

class ChatAnswerResponse(BaseModel):
    response: str
    conversation_id: str
    message_id: str
    audio_url: Optional[str] = None
    retrieved_sources: List[Dict[str, Any]] = []
    memories_extracted: List[str] = []
