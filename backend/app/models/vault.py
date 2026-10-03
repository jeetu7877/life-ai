import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base

class SecureVaultItem(Base):
    """
    Secure storage for highly sensitive personal data (PAN, Aadhaar, Passports, Bank Accounts, Credentials).
    Values are strongly encrypted at rest and never placed into plain ChromaDB embeddings or unmasked logs.
    """
    __tablename__ = "secure_vault"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    key_name = Column(String(100), nullable=False)  # e.g., "PAN Card Number", "Aadhaar Number", "Passport ID"
    item_type = Column(String(50), nullable=False, index=True)  # pan, aadhaar, passport, bank, api_key, password, other
    encrypted_value = Column(Text, nullable=False)  # Fernet encrypted ciphertext
    masked_hint = Column(String(100), nullable=True)  # e.g., "ABCDE****F" or "XXXX-XXXX-1234"
    document_id = Column(String(36), nullable=True)  # Source document reference if extracted from OCR
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="vault_items")
