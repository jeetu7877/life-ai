from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class VaultItemCreate(BaseModel):
    key_name: str
    item_type: str  # pan, aadhaar, passport, bank, api_key, password, other
    raw_value: str  # Plaintext value sent by authenticated user, immediately encrypted before storage
    notes: Optional[str] = None

class VaultItemResponse(BaseModel):
    id: str
    key_name: str
    item_type: str
    masked_hint: Optional[str] = None  # Safe masked representation
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class VaultItemRevealResponse(BaseModel):
    id: str
    key_name: str
    item_type: str
    decrypted_value: str
    notes: Optional[str] = None
