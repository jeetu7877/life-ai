import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.services.orchestrator import agent_orchestrator

logger = logging.getLogger("life.agent")

class AgentService:
    """
    AgentService facade providing backward compatibility for all chat and voice routes:
    Delegates processing directly to the Central AgentOrchestrator.
    """

    def process_message(
        self,
        db: Session,
        user_id: str,
        user_message: str,
        chat_history: List[Dict[str, str]],
        timezone: str = "Asia/Kolkata",
        conversation_id: Optional[str] = None
    ) -> Dict[str, Any]:
        return agent_orchestrator.process_request(
            db=db,
            user_id=user_id,
            user_message=user_message,
            chat_history=chat_history,
            conversation_id=conversation_id,
            timezone=timezone
        )

agent_service = AgentService()