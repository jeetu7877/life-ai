import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class PersonalGoal(Base):
    """
    Personal long-term or mid-term goal managed by Life AI.
    Example: "Crack an internship in 3 months", "Learn Rust", "Build Life AI 2.0"
    """
    __tablename__ = "personal_goals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="career", index=True)  # career, study, project, health, financial, personal
    
    # Priority: 1 (highest) to 5 (lowest)
    priority = Column(Integer, default=1, index=True)
    # Status: active, in_progress, completed, paused, cancelled
    status = Column(String(50), default="active", index=True)
    
    # Progress: 0.0 to 100.0%
    progress = Column(Float, default=0.0)
    
    deadline = Column(DateTime, nullable=True, index=True)
    target_period = Column(String(50), nullable=True)  # e.g., "3 months", "Q4 2026"
    metadata_json = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="personal_goals")
    milestones = relationship("GoalMilestone", back_populates="goal", cascade="all, delete-orphan", order_by="GoalMilestone.order_index")


class GoalMilestone(Base):
    """
    Sequential milestone towards achieving a personal goal.
    Example: Goal: Crack internship -> Milestones: [1. Resume, 2. DSA, 3. Projects, 4. Applications, 5. Interviews]
    """
    __tablename__ = "goal_milestones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    goal_id = Column(String(36), ForeignKey("personal_goals.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    # Status: pending, in_progress, completed, skipped
    status = Column(String(50), default="pending", index=True)
    deadline = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    goal = relationship("PersonalGoal", back_populates="milestones")
    user = relationship("User", back_populates="goal_milestones")
