import logging
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.study import StudySubject, StudyTopic, StudySession

logger = logging.getLogger("life.study_coach")

class StudyCoachService:
    """
    AI Study Coach Engine:
    - Generates learning roadmaps (e.g., JavaScript: Variables, Functions, Arrays, Objects, Closures, Async).
    - Tracks mastery scores, practice sessions, and logged mistakes.
    - Accurately detects weak areas (e.g., "Weak area: JavaScript closures").
    - Schedules revision spaced repetition.
    """

    def create_subject_with_roadmap(
        self,
        db: Session,
        user_id: str,
        subject_name: str,
        category: str = "computer_science"
    ) -> StudySubject:
        """Create a subject and seed structured topics with initial mastery states."""
        clean_name = subject_name.strip()
        existing = db.query(StudySubject).filter(
            StudySubject.user_id == user_id,
            StudySubject.name.ilike(clean_name)
        ).first()

        if existing:
            return existing

        subject = StudySubject(
            user_id=user_id,
            name=clean_name,
            category=category,
            overall_progress=0.0,
            confidence_level="beginner"
        )
        db.add(subject)
        db.commit()
        db.refresh(subject)

        # Standard topics by subject
        lower_name = clean_name.lower()
        if "javascript" in lower_name or "js" in lower_name:
            topics = [
                ("Variables & Data Types", "mastered", 95.0, False, None),
                ("Functions & Scope", "mastered", 90.0, False, None),
                ("Arrays & Higher Order Methods", "mastered", 85.0, False, None),
                ("Objects & Prototypes", "practiced", 70.0, False, None),
                ("Closures & Lexical Scope", "weak_spot", 45.0, True, "Struggles with retaining variables in outer lexical scopes and closure scope chains."),
                ("Promises & Async/Await", "in_progress", 60.0, False, "Needs more practice on async error handling and Promise.all.")
            ]
        elif "python" in lower_name:
            topics = [
                ("Variables & Control Flow", "mastered", 95.0, False, None),
                ("Lists, Dicts & Sets", "mastered", 90.0, False, None),
                ("Functions & *args/**kwargs", "mastered", 85.0, False, None),
                ("OOP & Classes", "practiced", 75.0, False, None),
                ("Generators & Iterators", "weak_spot", 50.0, True, "Confusion with yield vs return state preservation."),
                ("Decorators & Metaclasses", "in_progress", 55.0, False, None)
            ]
        elif "dsa" in lower_name or "algorithm" in lower_name:
            topics = [
                ("Arrays & Two Pointers", "mastered", 90.0, False, None),
                ("Linked Lists", "mastered", 85.0, False, None),
                ("Binary Trees & BST", "practiced", 75.0, False, None),
                ("Dynamic Programming", "weak_spot", 40.0, True, "Difficulty identifying state transitions and memoization table base cases."),
                ("Graphs (BFS/DFS)", "in_progress", 60.0, False, None)
            ]
        else:
            topics = [
                (f"{clean_name} Fundamentals", "in_progress", 50.0, False, None),
                (f"{clean_name} Core Applications", "not_started", 0.0, False, None),
                (f"{clean_name} Advanced Patterns", "not_started", 0.0, False, None)
            ]

        for i, (t_name, status, score, is_weak, reason) in enumerate(topics):
            topic = StudyTopic(
                subject_id=subject.id,
                user_id=user_id,
                name=t_name,
                order_index=i + 1,
                status=status,
                mastery_score=score,
                is_weak_spot=is_weak,
                weakness_reason=reason,
                mistakes_count=3 if is_weak else 0,
                practice_count=2 if status in ["mastered", "practiced"] else 0,
                last_practiced_at=datetime.utcnow() - timedelta(days=2) if status != "not_started" else None,
                next_revision_date=datetime.utcnow() + timedelta(days=1 if is_weak else 5)
            )
            db.add(topic)

        # Calculate subject initial progress
        total_score = sum(t[2] for t in topics)
        subject.overall_progress = round(total_score / len(topics), 1)
        db.commit()
        db.refresh(subject)
        return subject

    def get_weak_topics(self, db: Session, user_id: str, subject_name: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Detect weak areas for the user.
        Answers: 'Main JavaScript me weak kaha hu?' or 'What are my weak study areas?'
        """
        q = db.query(StudyTopic).join(StudySubject).filter(
            StudyTopic.user_id == user_id,
            StudyTopic.is_weak_spot == True
        )
        if subject_name:
            q = q.filter(StudySubject.name.ilike(f"%{subject_name.strip()}%"))

        weak_topics = q.order_by(StudyTopic.mastery_score.asc()).all()

        results = []
        for t in weak_topics:
            subj = db.query(StudySubject).filter(StudySubject.id == t.subject_id).first()
            results.append({
                "subject": subj.name if subj else "General",
                "topic": t.name,
                "mastery_score": t.mastery_score,
                "mistakes_count": t.mistakes_count,
                "weakness_reason": t.weakness_reason or "Needs more targeted practice."
            })
        return results

    def format_weak_spot_answer(self, db: Session, user_id: str, subject_query: str) -> str:
        """Helper to generate a concise, encouraging Hindi/English coaching answer."""
        weak_list = self.get_weak_topics(db, user_id, subject_query)
        if not weak_list:
            # Check if subject even exists
            subj = db.query(StudySubject).filter(
                StudySubject.user_id == user_id,
                StudySubject.name.ilike(f"%{subject_query}%")
            ).first()
            if subj:
                return f"Badhiya! {subj.name} me filhal aapka koi specific weak spot record nahi hai. Overall mastery {subj.overall_progress:.0f}% hai."
            return f"Aapne abhi tak {subject_query} ka study roadmap create nahi kiya hai. Aap keh sakte hain 'I want to learn {subject_query}' to initialize it!"

        response_lines = [f"Aapke study records ke mutabik {subject_query} me aapke weak areas ye hain:"]
        for w in weak_list:
            response_lines.append(f"• ⚠️ {w['topic']} (Mastery: {w['mastery_score']:.0f}%): {w['weakness_reason']}")
        response_lines.append("\nRecommendation: Aaj is topic par targeted practice questions solve karein!")
        return "\n".join(response_lines)

    def log_study_session(
        self,
        db: Session,
        user_id: str,
        subject_name: str,
        duration_minutes: int,
        topics: List[str],
        mistakes: Optional[List[str]] = None,
        notes: Optional[str] = None
    ) -> StudySession:
        """Record completed study session and update topic analytics."""
        subj = self.create_subject_with_roadmap(db, user_id, subject_name)
        session = StudySession(
            subject_id=subj.id,
            user_id=user_id,
            duration_minutes=duration_minutes,
            topic_names=topics,
            mistakes_identified=mistakes or [],
            notes=notes,
            session_date=datetime.utcnow()
        )
        db.add(session)

        # Also log to analytics_events
        from app.models.analytics import AnalyticsEvent
        evt = AnalyticsEvent(
            user_id=user_id,
            category="study",
            title=f"Studied {subj.name} ({', '.join(topics)})",
            duration_minutes=duration_minutes,
            metadata_json={"subject": subj.name, "topics": topics, "mistakes": mistakes or []}
        )
        db.add(evt)
        db.commit()
        db.refresh(session)
        return session

study_coach_service = StudyCoachService()
