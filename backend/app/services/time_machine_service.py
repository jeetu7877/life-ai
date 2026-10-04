import logging
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.timeline import DailyActivity
from app.models.memory import Memory
from app.models.goal import PersonalGoal
from app.models.task import AgentTask
from app.models.github import GitHubRepository

logger = logging.getLogger("life.time_machine")

class TimeMachineService:
    """
    Personal Time Machine Service:
    Reconstructs historical states and activities for any past date or timeframe.
    Rules:
    - Never fabricates missing historical events.
    - If insufficient data exists, returns: "I don't have enough recorded activity for that period."
    """

    def parse_query_target_date(self, query: str) -> Optional[datetime]:
        lower = query.lower()
        now = datetime.utcnow()

        if "one month ago" in lower or "1 month ago" in lower or "last month" in lower:
            return now - timedelta(days=30)
        if "two weeks ago" in lower or "2 weeks ago" in lower:
            return now - timedelta(days=14)
        if "one week ago" in lower or "1 week ago" in lower or "last week" in lower:
            return now - timedelta(days=7)
        if "yesterday" in lower:
            return now - timedelta(days=1)

        # Match specific month/day like "september 1" or "sep 1" or "2026-09-01"
        iso_match = re.search(r'(\d{4})-(\d{2})-(\d{2})', query)
        if iso_match:
            try:
                return datetime.strptime(iso_match.group(0), "%Y-%m-%d")
            except ValueError:
                pass

        month_match = re.search(r'(january|february|march|april|may|june|july|august|september|october|november|december|sep|oct|nov|dec|jan|feb|mar|apr|jun|jul|aug)\s+(\d{1,2})', lower)
        if month_match:
            month_str = month_match.group(1)[:3]
            day = int(month_match.group(2))
            months_map = {
                "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
                "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
            }
            m_num = months_map.get(month_str, 9)
            year = now.year if m_num <= now.month else now.year - 1
            try:
                return datetime(year, m_num, day)
            except ValueError:
                pass

        return None

    def reconstruct_time_period(self, db: Session, user_id: str, query: str) -> Dict[str, Any]:
        target_dt = self.parse_query_target_date(query)
        if not target_dt:
            # Fallback to 30 days ago if query mentions historical period
            target_dt = datetime.utcnow() - timedelta(days=30)

        target_date_str = target_dt.strftime("%Y-%m-%d")
        window_start = target_dt - timedelta(days=3)
        window_end = target_dt + timedelta(days=3)

        # 1. Timeline activities on or around target date
        activities = db.query(DailyActivity).filter(
            DailyActivity.user_id == user_id,
            DailyActivity.activity_date >= window_start.strftime("%Y-%m-%d"),
            DailyActivity.activity_date <= window_end.strftime("%Y-%m-%d")
        ).all()

        # 2. Memories around target date
        memories = db.query(Memory).filter(
            Memory.user_id == user_id,
            Memory.created_at >= window_start,
            Memory.created_at <= window_end
        ).all()

        # 3. Check if any activity or memory exists
        if not activities and not memories:
            return {
                "status": "insufficient_data",
                "target_date": target_date_str,
                "message": f"I don't have enough recorded activity for that period ({target_date_str})."
            }

        act_items = [{
            "date": a.activity_date,
            "title": a.title,
            "category": a.category,
            "description": a.description
        } for a in activities]

        mem_items = [m.content for m in memories]

        return {
            "status": "found",
            "target_date": target_date_str,
            "activities": act_items,
            "memories": mem_items
        }

    def format_time_machine_response(self, db: Session, user_id: str, query: str) -> str:
        recon = self.reconstruct_time_period(db, user_id, query)
        target = recon.get("target_date", "that date")

        if recon.get("status") == "insufficient_data":
            return f"🕰️ **Personal Time Machine**:\nI don't have enough recorded activity for that period ({target}). Aap timeline ya journal mein uss din ki activities check kar sakte hain."

        lines = [
            f"🕰️ **Personal Time Machine Replay** ({target}):\n",
            f"📅 **Activities Recorded Around {target}**:"
        ]
        for a in recon.get("activities", []):
            lines.append(f"• **[{a['category'].title()}]** {a['title']} — {a['description']}")

        if recon.get("memories"):
            lines.append("\n🧠 **Memories Logged Around That Time**:")
            for m in recon["memories"][:3]:
                lines.append(f"• {m}")

        lines.append("\n*(Historical timeline reconstructed from immutable database activity records. Zero events fabricated.)*")
        return "\n".join(lines)

time_machine_service = TimeMachineService()
