import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class AnalyticsEvent(Base):
    """
    Structured productivity analytics event:
    Logs actual time and counts for study, coding, projects, tasks, and applications.
    Strictly recorded from actual events (never fabricated).
    """
    __tablename__ = "analytics_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Event category: study, coding, project, task_completion, application, goal_progress
    category = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    duration_minutes = Column(Integer, default=0)
    
    # Associated tags (e.g. project_name: "SQL RAG", subject: "JavaScript")
    project_tag = Column(String(100), nullable=True, index=True)
    metadata_json = Column(JSON, default=dict)

    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="analytics_events")


class DailyBrief(Base):
    """
    Persisted Daily AI Brief (Morning, Evening, or Weekly Review).
    Summarizes yesterday's accomplishments, today's top priorities, urgent deadlines, and recommendations.
    """
    __tablename__ = "daily_briefs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Brief type: morning, evening, weekly_review
    brief_type = Column(String(50), default="morning", index=True)
    brief_date = Column(String(50), nullable=False, index=True)  # YYYY-MM-DD
    
    summary_yesterday = Column(JSON, default=list)  # List of accomplishments & completed tasks
    priorities_today = Column(JSON, default=list)    # Top priority tasks & focus areas
    urgent_deadlines = Column(JSON, default=list)    # Upcoming deadlines & approaching dates
    recommendation = Column(Text, nullable=True)     # Most valuable single next action
    
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="daily_briefs")
