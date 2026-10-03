import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class DailyActivity(Base):
    """
    Chronological activity log representing daily accomplishments, learning, work, and plans.
    """
    __tablename__ = "daily_activities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    activity_date = Column(String(50), nullable=False, index=True)  # YYYY-MM-DD
    activity_time = Column(String(50), nullable=True)  # HH:MM:SS or "08:15 AM"
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="work", index=True)  # coding, study, project, meeting, personal, achievement
    project_tag = Column(String(100), nullable=True, index=True)  # e.g., "SQL RAG", "NeuroNote"
    
    source_message_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="activities")
