import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Float, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class AgentToolLog(Base):
    """
    Audit log of all tool executions by the Agent Orchestrator.
    Tracks tool input parameters, outputs, latencies, and confirmation status.
    """
    __tablename__ = "agent_tool_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    conversation_id = Column(String(36), nullable=True, index=True)
    
    tool_name = Column(String(100), nullable=False, index=True)
    input_params = Column(JSON, default=dict)
    output_result = Column(JSON, default=dict)
    execution_time_ms = Column(Float, default=0.0)
    
    # Status: success, failed, requires_confirmation, denied
    status = Column(String(50), default="success", index=True)
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="tool_logs")
