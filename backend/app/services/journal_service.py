import logging
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.journal import JournalEntry
from app.models.memory import Memory

logger = logging.getLogger("life.journal")

class JournalService:
    """
    Personal Journal Intelligence Service:
    Provides structured reflection, lesson extraction, and deliberate long-term memory promotion.
    Strict privacy: Private thoughts stay strictly within journal_entries unless user explicitly marks as important_memory.
    """

    def create_entry(
        self,
        db: Session,
        user_id: str,
        content: str,
        title: Optional[str] = None,
        category: str = "private_journal",
        entry_date: Optional[str] = None
    ) -> JournalEntry:
        target_date = entry_date or datetime.utcnow().strftime("%Y-%m-%d")

        # Extract structured insights via deterministic parsing
        insights = {
            "events": [],
            "lessons": [],
            "goals": [],
            "achievements": []
        }
        for line in content.split("\n"):
            line_str = line.strip()
            if not line_str:
                continue
            lower = line_str.lower()
            if any(k in lower for k in ["learned", "lesson", "realized", "samajh aaya"]):
                insights["lessons"].append(line_str)
            elif any(k in lower for k in ["goal", "target", "kal se", "karna hai", "plan"]):
                insights["goals"].append(line_str)
            elif any(k in lower for k in ["completed", "built", "finished", "achieved", "crack kiya"]):
                insights["achievements"].append(line_str)
            else:
                insights["events"].append(line_str)

        entry = JournalEntry(
            user_id=user_id,
            entry_date=target_date,
            title=title or f"Reflection for {target_date}",
            content=content,
            category=category,
            extracted_insights=insights,
            is_promoted_to_memory=False
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)

        # If user explicitly declared category as important_memory, promote immediately
        if category == "important_memory":
            self.promote_to_memory(db, user_id, entry.id)

        return entry

    def promote_to_memory(self, db: Session, user_id: str, entry_id: str) -> Optional[Memory]:
        """User-controlled promotion of journal entry into permanent memory table."""
        entry = db.query(JournalEntry).filter(
            JournalEntry.id == entry_id,
            JournalEntry.user_id == user_id
        ).first()
        if not entry:
            return None

        memory = Memory(
            user_id=user_id,
            content=f"Journal Reflection ({entry.entry_date}): {entry.content}",
            memory_type="journal_reflection",
            importance=4,
            confidence=1.0,
            status="active",
            event_date=entry.entry_date,
            topic="personal_reflection",
            metadata_json={"journal_entry_id": entry.id, "category": entry.category}
        )
        db.add(memory)
        entry.is_promoted_to_memory = True
        entry.promoted_memory_id = memory.id
        db.commit()
        db.refresh(memory)
        return memory

    def list_entries(self, db: Session, user_id: str, limit: int = 20) -> List[JournalEntry]:
        return db.query(JournalEntry).filter(
            JournalEntry.user_id == user_id
        ).order_by(JournalEntry.entry_date.desc()).limit(limit).all()

journal_service = JournalService()
