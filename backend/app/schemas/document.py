from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class DocumentChunkResponse(BaseModel):
    id: str
    chunk_index: int
    content: str
    page_number: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: str
    user_id: str
    filename: str
    original_filename: str
    file_type: str
    category: str
    file_size: int
    extraction_status: str
    error_message: Optional[str] = None
    extracted_text: Optional[str] = None
    structured_fields: Optional[Dict[str, Any]] = None
    metadata_json: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    chunks: Optional[List[DocumentChunkResponse]] = []

    class Config:
        from_attributes = True
