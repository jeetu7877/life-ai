from datetime import datetime, timedelta
import re
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.timeline import DailyActivity
from app.models.conversation import Message

class TimelineService:
    def parse_natural_date_query(self, query: str) -> Optional[str]:
        """Convert terms like 'today', 'yesterday', '2 october' into YYYY-MM-DD."""
        q = query.lower()
        today = datetime.utcnow()

        if "today" in q or "aaj" in q:
            return today.strftime("%Y-%m-%d")
        if "yesterday" in q or "kal" in q and "beeta" in q or "yesterday" in q:
            return (today - timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Matches formats like "2026-10-02" or "October 2" or "2 October"
        iso_match = re.search(r'\b(20\d\d-[0-1]\d-[0-3]\d)\b', q)
        if iso_match:
            return iso_match.group(1)

        months = {
            "january": 1, "jan": 1, "february": 2, "feb": 2, "march": 3, "mar": 3,
            "april": 4, "apr": 4, "may": 5, "june": 6, "jun": 6, "july": 7, "jul": 7,
            "august": 8, "aug": 8, "september": 9, "sep": 9, "october": 10, "oct": 10,
            "november": 11, "nov": 11, "december": 12, "dec": 12
        }

        for m_name, m_num in months.items():
            pattern1 = rf'\b(\d{{1,2}})\s+{m_name}\b'
            pattern2 = rf'\b{m_name}\s+(\d{{1,2}})\b'
            m1 = re.search(pattern1, q)
            m2 = re.search(pattern2, q)
            day = None
            if m1:
                day = int(m1.group(1))
            elif m2:
                day = int(m2.group(1))
            
            if day:
                # Default to current year
                year = today.year
                # Check if specific year is mentioned
                yr_match = re.search(r'\b(20\d\d)\b', q)
                if yr_match:
                    year = int(yr_match.group(1))
                return f"{year:04d}-{m_num:02d}-{day:02d}"

        return None

    def get_activities_for_date(self, db: Session, user_id: str, date_str: str) -> List[DailyActivity]:
        """Fetch all activities logged for a calendar day."""
        return db.query(DailyActivity).filter(
            DailyActivity.user_id == user_id,
            DailyActivity.activity_date == date_str
        ).order_by(DailyActivity.activity_time.asc()).all()

    def get_conversation_history_for_date(self, db: Session, user_id: str, date_str: str) -> List[Message]:
        """Fetch messages sent during that calendar day."""
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d")
            start_dt = target_date.replace(hour=0, minute=0, second=0)
            end_dt = target_date.replace(hour=23, minute=59, second=59)
            
            return db.query(Message).filter(
                Message.user_id == user_id,
                Message.timestamp >= start_dt,
                Message.timestamp <= end_dt
            ).order_by(Message.timestamp.asc()).all()
        except Exception:
            return []

    def search_past_conversations(
        self,
        db: Session,
        user_id: str,
        query: str,
        top_k: int = 5,
        exclude_conversation_id: Optional[str] = None
    ) -> List[Message]:
        """
        Cross-session historical conversation search:
        Retrieves relevant historical messages across all user conversations
        outside of the current session's immediate window.
        Enforces strict user isolation.
        """
        try:
            # Check for date query first
            detected_date = self.parse_natural_date_query(query)
            if detected_date:
                msgs = self.get_conversation_history_for_date(db, user_id, detected_date)
                if exclude_conversation_id:
                    msgs = [m for m in msgs if m.conversation_id != exclude_conversation_id]
                return msgs[:top_k]

            # Otherwise, keyword/relevance search across past messages
            q_lower = query.lower()
            stop_words = {"what", "did", "tell", "you", "about", "last", "month", "week", "yesterday", "earlier", "maine", "kya", "bataya", "tha"}
            keywords = [w for w in re.findall(r'\b[a-zA-Z0-9_]{3,}\b', q_lower) if w not in stop_words]

            base_q = db.query(Message).filter(Message.user_id == user_id)
            if exclude_conversation_id:
                base_q = base_q.filter(Message.conversation_id != exclude_conversation_id)

            if keywords:
                from sqlalchemy import or_
                conditions = [Message.content.ilike(f"%{kw}%") for kw in keywords]
                candidates = base_q.filter(or_(*conditions)).order_by(Message.timestamp.desc()).limit(50).all()
                if candidates:
                    scored = []
                    for cand in candidates:
                        c_lower = cand.content.lower()
                        match_count = sum(1 for kw in keywords if kw in c_lower)
                        scored.append((match_count, cand))
                    scored.sort(key=lambda x: x[0], reverse=True)
                    return [c for _, c in scored[:top_k]]

            # Fallback to most recent past messages
            return base_q.order_by(Message.timestamp.desc()).limit(top_k).all()
        except Exception:
            return []

timeline_service = TimelineService()
