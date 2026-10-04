import logging
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.services.tools.base import BaseTool, ToolCategory, RiskLevel, ToolExecutionResult
from app.models.conversation import Conversation, Message, ConversationSummary

logger = logging.getLogger(__name__)

class ConversationSearchInput(BaseModel):
    query: str = Field(description="Search term or topic to look up in past conversations and dialogues")
    limit: int = Field(default=5, description="Number of past conversations or messages to retrieve")

class ConversationSearchTool(BaseTool):
    name = "search_conversations"
    description = "Searches through past conversation history and semantic summaries across previous chat sessions."
    category = ToolCategory.MEMORY
    risk_level = RiskLevel.READ_ONLY
    input_schema = ConversationSearchInput

    def execute(self, user_id: str, args: ConversationSearchInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            q_lower = args.query.lower()
            results = []

            # 1. First search conversation summaries
            summaries = db.query(ConversationSummary).join(Conversation).filter(
                Conversation.user_id == user_id
            ).order_by(desc(ConversationSummary.last_updated_at)).limit(20).all()

            for s in summaries:
                if q_lower in s.summary_text.lower():
                    results.append({
                        "type": "conversation_summary",
                        "conversation_id": s.conversation_id,
                        "text": s.summary_text,
                        "key_points": s.key_points
                    })

            # 2. Search message contents
            messages = db.query(Message).join(Conversation).filter(
                Conversation.user_id == user_id,
                Message.content.ilike(f"%{args.query}%")
            ).order_by(desc(Message.timestamp)).limit(args.limit).all()

            for m in messages:
                results.append({
                    "type": "message",
                    "role": m.role,
                    "content": m.content,
                    "timestamp": m.timestamp.isoformat() if m.timestamp else None,
                    "conversation_id": m.conversation_id
                })

            return ToolExecutionResult(
                success=True,
                data=results[:args.limit],
                source_attribution="conversation_history"
            )
        except Exception as e:
            logger.error(f"Error executing ConversationSearchTool: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e),
                data=[]
            )
