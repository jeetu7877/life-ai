import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class StudySubject(Base):
    """
    High-level academic or technical subject being studied.
    Example: "JavaScript", "DBMS", "Operating Systems", "DSA"
    """
    __tablename__ = "study_subjects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(50), default="computer_science", index=True)
    
    overall_progress = Column(Float, default=0.0)  # 0 to 100%
    confidence_level = Column(String(50), default="beginner")  # beginner, intermediate, advanced, master

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="study_subjects")
    topics = relationship("StudyTopic", back_populates="subject", cascade="all, delete-orphan", order_by="StudyTopic.order_index")
    sessions = relationship("StudySession", back_populates="subject", cascade="all, delete-orphan")


class StudyTopic(Base):
    """
    Discrete topic within a study subject with mastery tracking and weak-spot detection.
    Example: Subject: "JavaScript" -> Topics:
    - Variables (mastered)
    - Functions (mastered)
    - Objects (learning)
    - Closures (weak_spot)
    - Async JavaScript (not_started)
    """
    __tablename__ = "study_topics"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    subject_id = Column(String(36), ForeignKey("study_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False, index=True)
    order_index = Column(Integer, default=0)
    
    # Status: not_started, in_progress, practiced, mastered, weak_spot
    status = Column(String(50), default="not_started", index=True)
    
    # Mastery score: 0 to 100
    mastery_score = Column(Float, default=0.0)
    mistakes_count = Column(Integer, default=0)
    practice_count = Column(Integer, default=0)
    
    is_weak_spot = Column(Boolean, default=False, index=True)
    weakness_reason = Column(Text, nullable=True)  # e.g., "Repeated confusion with lexical scoping and closure scope chain"
    
    last_practiced_at = Column(DateTime, nullable=True)
    next_revision_date = Column(DateTime, nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subject = relationship("StudySubject", back_populates="topics")
    user = relationship("User", back_populates="study_topics")


class StudySession(Base):
    """
    Chronological learning session log for tracking time and mistakes.
    """
    __tablename__ = "study_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    subject_id = Column(String(36), ForeignKey("study_subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    topic_names = Column(JSON, default=list)
    duration_minutes = Column(Integer, default=30)
    notes = Column(Text, nullable=True)
    
    quiz_score = Column(Float, nullable=True)  # Percentage if tested
    mistakes_identified = Column(JSON, default=list)  # ["closures lexical scope", "promise chaining syntax"]

    session_date = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    subject = relationship("StudySubject", back_populates="sessions")
    user = relationship("User", back_populates="study_sessions")
