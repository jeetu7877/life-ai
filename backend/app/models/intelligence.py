import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class ProjectHealthRecord(Base):
    """
    Project Health Score Model:
    Evaluates connected code repositories across 5 verifiable dimensions:
    - Code Activity
    - Testing Coverage/Existence
    - Documentation
    - Security / Secret Hygiene
    - Deployment Readiness
    """
    __tablename__ = "project_health_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    repo_name = Column(String(255), nullable=False, index=True)
    code_activity_score = Column(Integer, default=70)
    testing_score = Column(Integer, default=60)
    documentation_score = Column(Integer, default=70)
    security_score = Column(Integer, default=85)
    deployment_score = Column(Integer, default=80)
    overall_score = Column(Integer, default=73)

    evidence_json = Column(JSON, default=dict)        # {dimension: reason/evidence}
    recommendations_json = Column(JSON, default=list) # actionable next steps

    recorded_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="project_health_records")


class RiskEvent(Base):
    """
    Personal Risk Detector:
    Tracks detected risks (deadlines approaching, inactive goals, missing tests, secret exposures).
    """
    __tablename__ = "risk_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    category = Column(String(50), nullable=False, index=True)  # deadline, goal_stagnation, task_failure, stale_project, secret_hygiene, missing_tests
    severity = Column(String(20), default="medium", index=True) # low, medium, high
    title = Column(String(255), nullable=False)
    evidence = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=False)
    status = Column(String(20), default="active", index=True)   # active, resolved, dismissed

    detected_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="risk_events")


class PatternEvent(Base):
    """
    Personal Pattern Detector:
    Tracks observed recurring patterns in user activity with supporting evidence and confidence.
    """
    __tablename__ = "pattern_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    pattern_type = Column(String(50), nullable=False, index=True) # time_of_day, task_size, consistency, study_habit
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    evidence = Column(Text, nullable=False)
    confidence = Column(Float, default=0.85)

    detected_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="pattern_events")


class DecisionDebateSession(Base):
    """
    Personal Decision Debate:
    Stores structured multi-option comparative analyses and evidence-based recommendations.
    """
    __tablename__ = "decision_debate_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    topic = Column(String(255), nullable=False)
    option_a = Column(String(100), nullable=False)
    option_b = Column(String(100), nullable=False)

    analysis_json = Column(JSON, default=dict)   # advantages, disadvantages, goal alignment, risks, time cost
    recommendation = Column(Text, nullable=False)
    confidence = Column(String(20), default="medium")

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="decision_debate_sessions")


class BottleneckAnalysisRecord(Base):
    """
    Why Am I Stuck? / Bottleneck Detector:
    Captures evidence-based bottleneck analyses without psychological diagnoses.
    """
    __tablename__ = "bottleneck_analysis_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    problem = Column(String(255), nullable=False)
    evidence = Column(Text, nullable=False)
    likely_cause = Column(Text, nullable=False)
    recommended_action = Column(Text, nullable=False)
    category = Column(String(50), default="CONSISTENCY", index=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="bottleneck_records")
