import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class ProactiveInsight(Base):
    """
    Proactive AI insight or contextual suggestion generated for the user.
    Never spammy: strictly governed by importance threshold and user settings.
    """
    __tablename__ = "proactive_insights"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Insight category: goal_stagnation, deadline_approaching, repeated_mistake, study_reminder, task_overdue, project_inactivity
    insight_type = Column(String(50), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    reason = Column(Text, nullable=False)
    
    # Importance: 1 (info), 2 (minor), 3 (moderate), 4 (important), 5 (critical)
    importance = Column(Integer, default=3, index=True)
    source = Column(String(100), default="proactive_scanner", index=True)  # goal, task, study, github, timeline
    
    action_label = Column(String(100), nullable=True)  # e.g., "Resume Goal", "Practice Closures"
    action_payload = Column(JSON, default=dict)

    is_dismissed = Column(Boolean, default=False, index=True)
    is_actioned = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="proactive_insights")


class ProactiveSetting(Base):
    """
    User controls for proactive suggestions:
    - On/Off toggle
    - Quiet hours
    - Minimum importance threshold
    - Max notifications per day
    """
    __tablename__ = "proactive_settings"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    is_enabled = Column(Boolean, default=True)
    quiet_hours_start = Column(String(10), default="23:00")  # HH:MM
    quiet_hours_end = Column(String(10), default="08:00")    # HH:MM
    min_importance = Column(Integer, default=3)              # 1-5
    max_suggestions_per_day = Column(Integer, default=5)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="proactive_setting")
