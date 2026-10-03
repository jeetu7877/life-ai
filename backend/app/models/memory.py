import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, Integer, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Memory(Base):
    __tablename__ = "memories"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    content = Column(Text, nullable=False)
    # Types: profile, skill, preference, project, education, achievement, goal, 
    # interest, learning, relationship, activity, decision, plan, important_event, personal_fact
    memory_type = Column(String(50), nullable=False, index=True)
    
    importance = Column(Integer, default=3)  # Scale 1-5
    confidence = Column(Float, default=1.0)   # Scale 0.0 - 1.0
    status = Column(String(50), default="active", index=True)  # active, superseded, archived
    
    event_date = Column(String(50), nullable=True, index=True)  # ISO or YYYY-MM-DD
    source_conversation_id = Column(String(36), nullable=True)
    last_confirmed_at = Column(DateTime, default=datetime.utcnow)
    
    superseded_by_id = Column(String(36), nullable=True)
    topic = Column(String(100), nullable=True, index=True)  # e.g., best_friend, location, college, company
    source_message_id = Column(String(36), nullable=True)  # direct linkage to conversation message
    metadata_json = Column(JSON, default=dict)
    
    # Persistent Vector Embeddings stored directly in Database
    embedding = Column(JSON, nullable=True)  # List[float] vector representation
    embedding_status = Column(String(50), default="ready", index=True)  # ready, pending, failed
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="memories")
