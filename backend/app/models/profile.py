import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class PersonalProfile(Base):
    __tablename__ = "profiles"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    
    name = Column(String(255), nullable=True)
    preferred_name = Column(String(100), nullable=True)
    education = Column(String(255), nullable=True)
    college = Column(String(255), nullable=True)
    degree = Column(String(100), nullable=True)
    branch = Column(String(100), nullable=True)
    
    # Structured JSON lists/dictionaries
    skills = Column(JSON, default=list)  # ["Python", "FastAPI", "React"]
    programming_languages = Column(JSON, default=list)
    frameworks = Column(JSON, default=list)
    tools = Column(JSON, default=list)
    projects = Column(JSON, default=list)  # [{"name": "SQL RAG", "tech": ["Python", "ChromaDB"]}]
    interests = Column(JSON, default=list)
    goals = Column(JSON, default=list)
    preferences = Column(JSON, default=dict)  # {"language": "Hinglish", "theme": "dark"}
    current_focus = Column(Text, nullable=True)
    achievements = Column(JSON, default=list)
    important_dates = Column(JSON, default=dict)  # {"birthday": "1998-05-12"}
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")
