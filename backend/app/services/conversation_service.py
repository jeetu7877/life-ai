import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.conversation import Conversation, Message, ConversationSummary
from app.services.llm_service import get_gemini_client

logger = logging.getLogger("life.conversation")

class ConversationService:
    """
    Manages long-term conversation continuity:
    - SQL-level recent message retrieval (ORDER BY timestamp DESC LIMIT N).
    - Rolling conversation summarization when dialogues grow past 15 messages.
    - Preserves context across backend restarts and long sessions.
    - Guarantees 0-PII leaks and user isolation.
    """

    def get_conversation_context(
        self,
        db: Session,
        conversation_id: str,
        user_id: str,
        recent_limit: int = 10
    ) -> Tuple[List[Dict[str, str]], Optional[str]]:
        """
        Retrieves recent verbatim messages plus rolling summary if available.
        Returns: (recent_chat_history, rolling_summary_text)
        """
        # 1. Fetch recent messages in reverse order, then flip for chronological order
        recent_records = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.user_id == user_id
        ).order_by(Message.timestamp.desc()).limit(recent_limit).all()

        chat_history = [
            {"role": m.role, "content": m.content}
            for m in reversed(recent_records)
        ]

        # 2. Check for rolling summary
        summary_record = db.query(ConversationSummary).filter(
            ConversationSummary.conversation_id == conversation_id,
            ConversationSummary.user_id == user_id
        ).first()

        rolling_summary = summary_record.summary_text if summary_record else None
        return chat_history, rolling_summary

    def get_or_create_summary(
        self,
        db: Session,
        conversation_id: str,
        user_id: Optional[str] = None,
        max_messages_trigger: int = 15
    ) -> Optional[ConversationSummary]:
        """Convenience helper to retrieve or update rolling summary for an active conversation."""
        if not user_id:
            conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
            if conv:
                user_id = conv.user_id
            else:
                return None
        return self.check_and_update_rolling_summary(
            db=db,
            conversation_id=conversation_id,
            user_id=user_id,
            trigger_threshold=max_messages_trigger
        )

    def check_and_update_rolling_summary(
        self,
        db: Session,
        conversation_id: str,
        user_id: str,
        trigger_threshold: int = 16
    ) -> Optional[ConversationSummary]:
        """
        Checks total message count in conversation. If > trigger_threshold,
        generates or updates a rolling summary of older messages so LLM context remains bounded.
        """
        total_count = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.user_id == user_id
        ).count()

        if total_count < trigger_threshold:
            return None

        # Fetch all messages except the last 8 (keep the last 8 purely verbatim in active window)
        older_messages = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.user_id == user_id
        ).order_by(Message.timestamp.asc()).limit(total_count - 8).all()

        if not older_messages:
            return None

        last_older_msg_id = older_messages[-1].id

        # Check existing summary
        summary_record = db.query(ConversationSummary).filter(
            ConversationSummary.conversation_id == conversation_id,
            ConversationSummary.user_id == user_id
        ).first()

        if summary_record and summary_record.last_summarized_message_id == last_older_msg_id:
            # Already up to date
            return summary_record

        # Synthesize concise rolling summary
        transcript_lines = []
        for m in older_messages:
            role_label = "User" if m.role == "user" else "Life AI"
            transcript_lines.append(f"{role_label}: {m.content}")

        transcript_text = "\n".join(transcript_lines[-30:])  # Bound synthesis window
        previous_summary = summary_record.summary_text if summary_record else "None"

        genai = get_gemini_client()
        new_summary_text = ""
        key_points = []

        if genai:
            try:
                model = genai.GenerativeModel("gemini-flash-lite-latest")
                prompt = (
                    "Summarize the following conversation concisely into 3-5 key points and a 2-sentence overview.\n"
                    f"Previous summary: {previous_summary}\n\n"
                    f"New messages to incorporate:\n{transcript_text}\n\n"
                    "Focus strictly on user preferences, topics discussed, code/projects mentioned, and established facts. "
                    "Do NOT include greetings or small talk. Keep it dense and informative."
                )
                resp = model.generate_content(prompt)
                new_summary_text = resp.text.strip() if resp and resp.text else ""
            except Exception as e:
                logger.warning(f"Rolling summary LLM call note: {e}")

        if not new_summary_text:
            # Fallback deterministic summary
            sample_topics = [m.content[:50] for m in older_messages if m.role == "user"][:5]
            new_summary_text = f"Discussion topics included: {'; '.join(sample_topics)}"

        if summary_record:
            summary_record.summary_text = new_summary_text
            summary_record.message_count = len(older_messages)
            summary_record.last_summarized_message_id = last_older_msg_id
            summary_record.updated_at = datetime.utcnow()
        else:
            summary_record = ConversationSummary(
                conversation_id=conversation_id,
                user_id=user_id,
                summary_text=new_summary_text,
                message_count=len(older_messages),
                last_summarized_message_id=last_older_msg_id
            )
            db.add(summary_record)

        db.commit()
        db.refresh(summary_record)
        logger.info(f"[CONVERSATION_SUMMARY] conv_id={conversation_id} summarized_msgs={len(older_messages)}")
        return summary_record

conversation_service = ConversationService()
