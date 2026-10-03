import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False)  # e.g., "VAULT_ACCESS", "DOCUMENT_UPLOAD", "AUTH_LOGIN"
    resource = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)  # Strictly non-sensitive sanitized log details
    ip_address = Column(String(50), nullable=True)
    status = Column(String(50), default="SUCCESS")
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="audit_logs")
