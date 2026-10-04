import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.services.tools.base import BaseTool, ToolCategory, RiskLevel, ToolExecutionResult
from app.services.document_service import document_service
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)

class DocumentFieldLookupInput(BaseModel):
    query: str = Field(description="The user's query targeting a specific document field (e.g., roll number, marks, enrollment, subjects)")

class DocumentFieldLookupTool(BaseTool):
    name = "lookup_document_field"
    description = "Searches structured fields from verified uploaded documents (College ID, Marksheets, Resumes) for exact values like roll numbers, marks, enrollment numbers, subjects, or full summaries."
    category = ToolCategory.DOCUMENT
    risk_level = RiskLevel.READ_ONLY
    input_schema = DocumentFieldLookupInput

    def execute(self, user_id: str, args: DocumentFieldLookupInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            result = document_service.direct_field_lookup(db, user_id, args.query)
            if result:
                return ToolExecutionResult(
                    success=True,
                    data=result,
                    source_attribution=f"document:{result.get('document_name', 'uploaded_document')}"
                )
            return ToolExecutionResult(
                success=False,
                data=None,
                error="No matching structured document field found."
            )
        except Exception as e:
            logger.error(f"Error executing DocumentFieldLookupTool: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e)
            )

class DocumentSearchInput(BaseModel):
    query: str = Field(description="Search query to locate relevant passages within uploaded documents")
    top_k: int = Field(default=5, description="Number of document chunks to return (1-10)")
    category: Optional[str] = Field(default=None, description="Optional document category filter: college_id, marksheet, resume, identity, certificate, general")

class DocumentSearchTool(BaseTool):
    name = "search_documents"
    description = "Performs semantic and keyword search across the full text and chunks of all documents uploaded by the user."
    category = ToolCategory.DOCUMENT
    risk_level = RiskLevel.READ_ONLY
    input_schema = DocumentSearchInput

    def execute(self, user_id: str, args: DocumentSearchInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            results = rag_service.search_document_chunks(
                user_id=user_id,
                query=args.query,
                top_k=min(args.top_k, 10),
                category=args.category,
                db=db
            )
            return ToolExecutionResult(
                success=True,
                data=results,
                source_attribution="uploaded_documents"
            )
        except Exception as e:
            logger.error(f"Error executing DocumentSearchTool: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e),
                data=[]
            )
