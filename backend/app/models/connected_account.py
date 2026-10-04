import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class ConnectedAccount(Base):
    """
    Connected third-party service credentials (e.g. GitHub OAuth or Personal Access Tokens).
    Tokens are Fernet AES-128 encrypted before storage.
    """
    __tablename__ = "connected_accounts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    provider = Column(String(50), nullable=False, index=True)  # "github", "google", etc.
    account_username = Column(String(100), nullable=True)
    encrypted_access_token = Column(String(500), nullable=False)
    
    scopes = Column(JSON, default=list)  # e.g. ["repo", "read:user"]
    metadata_json = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="connected_accounts")
