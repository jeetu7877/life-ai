import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class JournalEntry(Base):
    """
    Personal Journal Intelligence:
    Allows users to maintain daily reflections, logs, and thoughts.
    User has complete control over what is kept as private journal vs promoted to long-term memory.
    """
    __tablename__ = "journal_entries"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    entry_date = Column(String(50), nullable=False, index=True)  # YYYY-MM-DD
    title = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)

    # Categories: private_journal, important_memory, goal, lesson, event
    category = Column(String(50), default="private_journal", nullable=False, index=True)

    extracted_insights = Column(JSON, default=dict)  # events, lessons, goals, decisions, achievements
    is_promoted_to_memory = Column(Boolean, default=False, index=True)
    promoted_memory_id = Column(String(36), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="journal_entries")
