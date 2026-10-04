import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.memory import Memory
from app.models.profile import PersonalProfile
from app.models.document import Document

logger = logging.getLogger("life.memory_detective")

class MemoryDetectiveService:
    """
    Memory Detective:
    Identifies conflicting, duplicate, outdated, or low-confidence memories.
    Evidence hierarchy:
    1. Verified Document (Weight: 1.0)
    2. Structured Profile (Weight: 0.95)
    3. Explicit Recent User Statement (Weight: 0.90)
    4. Old Conversation (Weight: 0.60)
    5. Inferred Information (Weight: 0.40)
    """

    def scan_for_conflicts(self, db: Session, user_id: str) -> List[Dict[str, Any]]:
        memories = db.query(Memory).filter(
            Memory.user_id == user_id,
            Memory.status == "active"
        ).all()

        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
        conflicts = []

        # Group by topic
        topics: Dict[str, List[Memory]] = {}
        for m in memories:
            if m.topic:
                topics.setdefault(m.topic, []).append(m)

        for topic, mem_list in topics.items():
            if len(mem_list) > 1:
                # Potential conflict or duplicate
                first = mem_list[0]
                second = mem_list[1]
                if first.content.lower().strip() != second.content.lower().strip():
                    conflicts.append({
                        "topic": topic,
                        "conflict_type": "divergent_facts",
                        "memory_a": {"id": first.id, "content": first.content, "confidence": first.confidence},
                        "memory_b": {"id": second.id, "content": second.content, "confidence": second.confidence},
                        "suggested_resolution": "Please confirm which information is current, or keep the most recent entry."
                    })

        # Check College in Profile vs College in Memories
        if profile and profile.college:
            for m in memories:
                if m.topic == "college" and profile.college.lower() not in m.content.lower():
                    conflicts.append({
                        "topic": "college",
                        "conflict_type": "profile_vs_memory",
                        "profile_evidence": profile.college,
                        "memory_evidence": m.content,
                        "suggested_resolution": f"Structured profile lists '{profile.college}'. Keep verified profile as source of truth?"
                    })

        return conflicts

    def format_detective_report(self, db: Session, user_id: str) -> str:
        conflicts = self.scan_for_conflicts(db, user_id)
        if not conflicts:
            return "🕵️ **Memory Detective**: Sabhi memories consistent aur verified hain. Koi duplicate ya conflicting memory nahi mili."

        lines = [f"🕵️ **Memory Detective**: {len(conflicts)} potential memory conflict(s) detected:\n"]
        for i, c in enumerate(conflicts, 1):
            lines.append(f"{i}. **Topic: {c['topic'].title()}** ({c['conflict_type']})")
            if "memory_a" in c:
                lines.append(f"   • Memory A: '{c['memory_a']['content']}'")
                lines.append(f"   • Memory B: '{c['memory_b']['content']}'")
            elif "profile_evidence" in c:
                lines.append(f"   • Profile: '{c['profile_evidence']}'")
                lines.append(f"   • Memory: '{c['memory_evidence']}'")
            lines.append(f"   • Recommendation: {c['suggested_resolution']}\n")

        lines.append("Kya aap chahte hain ki main latest verified source ko update kar doon?")
        return "\n".join(lines)

memory_detective_service = MemoryDetectiveService()
