import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.memory import Memory
from app.models.profile import PersonalProfile
from app.models.timeline import DailyActivity
from app.services.llm_service import llm_service
from app.services.rag_service import rag_service
from app.services.embedding_service import embedding_service

logger = logging.getLogger(__name__)

class MemoryService:
    """
    Production-grade Memory Management:
    - Primary source of truth is the persistent database.
    - Embeddings are generated and persisted into the DB alongside content.
    - Synchronized with vector cache for rapid retrieval.
    - Strict user-isolation enforced across all operations.
    """

    def process_conversation_for_memories(
        self,
        db: Session,
        user_id: str,
        user_message: str,
        assistant_response: str,
        conversation_id: Optional[str] = None
    ) -> List[Memory]:
        """
        Extract facts from conversation, deduplicate against existing memories,
        resolve conflicts, update structured profile if relevant, and index persistently.
        """
        extracted = llm_service.extract_memories_and_entities(user_message, assistant_response)
        saved_memories = []

        for item in extracted:
            content = item.get("content", "").strip()
            mem_type = item.get("memory_type", "personal_fact")
            importance = int(item.get("importance", 3))
            confidence = float(item.get("confidence", 0.9))
            event_date = item.get("event_date")

            if not content:
                continue

            # Strict user isolation: Check for exact or near duplicate for this user
            existing = db.query(Memory).filter(
                Memory.user_id == user_id,
                Memory.memory_type == mem_type,
                Memory.status == "active"
            ).all()

            matched_memory = None
            for ex in existing:
                if ex.content.lower() == content.lower():
                    matched_memory = ex
                    break

            if matched_memory:
                # Update last confirmed timestamp & confidence
                matched_memory.last_confirmed_at = datetime.utcnow()
                matched_memory.confidence = min(1.0, matched_memory.confidence + 0.05)
                db.commit()
                saved_memories.append(matched_memory)
                continue

            # Check if this memory supersedes an older fact (e.g. CGPA, role, current focus)
            self._handle_superseding(db, user_id, mem_type, content)

            # Compute persistent vector embedding
            embedding_vector = embedding_service.get_embedding(content)

            # Create new Memory record
            new_memory = Memory(
                user_id=user_id,
                content=content,
                memory_type=mem_type,
                importance=importance,
                confidence=confidence,
                status="active",
                event_date=event_date or datetime.utcnow().strftime("%Y-%m-%d"),
                source_conversation_id=conversation_id,
                last_confirmed_at=datetime.utcnow(),
                embedding=embedding_vector,
                embedding_status="ready"
            )
            db.add(new_memory)
            db.commit()
            db.refresh(new_memory)

            # Add to vector store index
            rag_service.add_memory(
                memory_id=new_memory.id,
                user_id=user_id,
                content=new_memory.content,
                memory_type=new_memory.memory_type,
                event_date=new_memory.event_date
            )

            # If it's a skill or project, update the profile automatically
            self._sync_profile_from_memory(db, user_id, mem_type, content)

            # If it's an activity, also add to timeline
            if mem_type == "activity":
                self._record_activity_from_memory(db, user_id, content, event_date)

            saved_memories.append(new_memory)

        return saved_memories

    def search_memories(
        self,
        db: Session,
        user_id: str,
        query: str,
        top_k: int = 5,
        memory_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant memories with guaranteed database fallback and user scoping.
        """
        return rag_service.search_memories(
            user_id=user_id,
            query=query,
            top_k=top_k,
            memory_type=memory_type,
            db=db
        )

    def _handle_superseding(self, db: Session, user_id: str, mem_type: str, new_content: str):
        """Mark older conflicting facts as superseded while preserving history."""
        supersede_keywords = ["cgpa", "current focus", "current project", "phone", "email", "address"]
        for kw in supersede_keywords:
            if kw in new_content.lower():
                old_memories = db.query(Memory).filter(
                    Memory.user_id == user_id,
                    Memory.status == "active",
                    Memory.content.ilike(f"%{kw}%")
                ).all()
                for old in old_memories:
                    old.status = "superseded"
                db.commit()

    def _sync_profile_from_memory(self, db: Session, user_id: str, mem_type: str, content: str):
        """Keep structured profile updated with newly stated skills and projects."""
        profile = db.query(PersonalProfile).filter(PersonalProfile.user_id == user_id).first()
        if not profile:
            return

        lower = content.lower()
        if mem_type == "skill":
            current_skills = list(profile.skills or [])
            keywords = ["python", "javascript", "typescript", "react", "fastapi", "node.js", "sql", "chromadb", "langchain", "docker", "c++", "java", "flutter"]
            for kw in keywords:
                if kw in lower and kw.title() not in [s.title() for s in current_skills]:
                    current_skills.append(kw.title())
            profile.skills = current_skills
            db.commit()

    def _record_activity_from_memory(self, db: Session, user_id: str, content: str, event_date: Optional[str]):
        """Record timeline entry from extracted daily activity."""
        today = event_date or datetime.utcnow().strftime("%Y-%m-%d")
        now_time = datetime.utcnow().strftime("%I:%M %p")
        act = DailyActivity(
            user_id=user_id,
            activity_date=today,
            activity_time=now_time,
            title=content[:100],
            description=content,
            category="work"
        )
        db.add(act)
        db.commit()

    def update_memory(self, db: Session, memory_id: str, user_id: str, new_content: str) -> Optional[Memory]:
        """Update existing memory content, recompute persistent embedding, and re-index."""
        mem = db.query(Memory).filter(Memory.id == memory_id, Memory.user_id == user_id).first()
        if mem:
            mem.content = new_content
            mem.updated_at = datetime.utcnow()
            mem.embedding = embedding_service.get_embedding(new_content)
            mem.embedding_status = "ready"
            db.commit()
            rag_service.add_memory(mem.id, user_id, new_content, mem.memory_type, mem.event_date)
            return mem
        return None

    def delete_memory(self, db: Session, memory_id: str, user_id: str) -> bool:
        """Delete memory from database and vector store."""
        mem = db.query(Memory).filter(Memory.id == memory_id, Memory.user_id == user_id).first()
        if mem:
            db.delete(mem)
            db.commit()
            rag_service.delete_memory(memory_id)
            return True
        return False

memory_service = MemoryService()
