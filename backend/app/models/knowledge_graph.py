import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class KnowledgeEntity(Base):
    """
    Core node in the Personal Knowledge Graph:
    Represents a discrete entity (person, skill, project, document, goal, education, company, etc.)
    Strictly isolated by user_id.
    """
    __tablename__ = "knowledge_entities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Entity Types: person, skill, project, document, goal, task, education, organization, topic, achievement
    entity_type = Column(String(50), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    metadata_json = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="knowledge_entities")
    outgoing_relations = relationship(
        "KnowledgeRelationship",
        foreign_keys="KnowledgeRelationship.source_entity_id",
        back_populates="source_entity",
        cascade="all, delete-orphan"
    )
    incoming_relations = relationship(
        "KnowledgeRelationship",
        foreign_keys="KnowledgeRelationship.target_entity_id",
        back_populates="target_entity",
        cascade="all, delete-orphan"
    )


class KnowledgeRelationship(Base):
    """
    Directed edge in the Personal Knowledge Graph:
    Represents relationships between entities with confidence and source provenance.
    Example: Jeet --[STUDIES_AT]--> NIT Jalandhar
             Jeet --[HAS_SKILL]--> Python
             Jeet --[HAS_BESTIE]--> Niku
    """
    __tablename__ = "knowledge_relationships"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    source_entity_id = Column(String(36), ForeignKey("knowledge_entities.id", ondelete="CASCADE"), nullable=False, index=True)
    target_entity_id = Column(String(36), ForeignKey("knowledge_entities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Relationships:
    # STUDIES_AT, HAS_SKILL, WORKS_ON, OWNS_DOCUMENT, HAS_GOAL, HAS_TASK,
    # RELATED_TO, WORKED_ON, LEARNED, COMPLETED, PLANS_TO, DEPENDS_ON,
    # PART_OF, MENTIONED_IN, HAS_BESTIE, FRIENDS_WITH
    relationship_type = Column(String(50), nullable=False, index=True)
    
    confidence = Column(Float, default=1.0)
    source = Column(String(100), default="memory", index=True)  # memory, profile, document, conversation, manual
    properties = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="knowledge_relationships")
    source_entity = relationship("KnowledgeEntity", foreign_keys=[source_entity_id], back_populates="outgoing_relations")
    target_entity = relationship("KnowledgeEntity", foreign_keys=[target_entity_id], back_populates="incoming_relations")
