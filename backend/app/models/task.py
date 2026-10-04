import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Integer, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class AgentTask(Base):
    """
    Actionable task or multi-step goal managed by Life AI.
    """
    __tablename__ = "agent_tasks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    # Status: pending, in_progress, completed, cancelled
    status = Column(String(50), default="pending", index=True)
    priority = Column(Integer, default=3)  # Scale 1-5
    # Type: reminder, action, plan, research, coding
    task_type = Column(String(50), default="action", index=True)
    
    plan_steps = Column(JSON, default=list)  # Steps breakdown with completion status
    due_date = Column(DateTime, nullable=True, index=True)
    result_summary = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="agent_tasks")
    reminders = relationship("AgentReminder", back_populates="task", cascade="all, delete-orphan")


class AgentReminder(Base):
    """
    Time-sensitive reminder scheduled for the user.
    """
    __tablename__ = "agent_reminders"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(String(36), ForeignKey("agent_tasks.id", ondelete="SET NULL"), nullable=True)
    
    reminder_text = Column(Text, nullable=False)
    remind_at = Column(DateTime, nullable=False, index=True)
    is_triggered = Column(Boolean, default=False, index=True)
    is_dismissed = Column(Boolean, default=False, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="agent_reminders")
    task = relationship("AgentTask", back_populates="reminders")
