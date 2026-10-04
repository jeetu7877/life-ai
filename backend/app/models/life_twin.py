import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class LifeTwinSnapshot(Base):
    """
    Life Twin Snapshot:
    An immutable, structured analytical representation of the user's life state at a specific point in time.
    Strictly isolated by user_id. Every core field contains provenance (source, confidence, updated_at).
    """
    __tablename__ = "life_twin_snapshots"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    snapshot_date = Column(String(50), nullable=False, index=True)  # YYYY-MM-DD or YYYY-MM
    is_current = Column(Boolean, default=False, index=True)

    # Core Dimensions with Provenance
    profile_data = Column(JSON, default=dict)      # name, preferred_name, college, branch, bio
    education_data = Column(JSON, default=dict)    # college, branch, batch, roll_number
    skills_data = Column(JSON, default=list)       # list of [{skill, source, confidence, updated_at}]
    projects_data = Column(JSON, default=list)     # list of [{name, role, status, repo, tech_stack}]
    goals_data = Column(JSON, default=list)        # list of [{goal, category, progress_pct, status}]
    tasks_data = Column(JSON, default=list)        # pending/completed tasks summary
    study_progress = Column(JSON, default=dict)    # subjects, mastery scores, weak topics
    weak_areas = Column(JSON, default=list)        # detected weak spots [{topic, reason, severity}]
    patterns = Column(JSON, default=list)          # observed recurring patterns
    metrics = Column(JSON, default=dict)           # study_hours, code_hours, tasks_completed

    summary_text = Column(Text, nullable=True)     # Human-readable markdown summary

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="life_twin_snapshots")
