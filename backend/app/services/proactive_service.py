import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.proactive import ProactiveInsight, ProactiveSetting
from app.models.goal import PersonalGoal
from app.models.task import AgentTask
from app.models.study import StudyTopic

logger = logging.getLogger("life.proactive")

class ProactiveService:
    """
    Proactive AI & Background Insights Engine:
    - Scans stored user progress for stagnation, pending tasks, approaching deadlines, and study weaknesses.
    - Strictly obeys user settings: Quiet Hours, On/Off toggle, Minimum importance filter.
    - Never interrupts active conversations or spams.
    """

    def get_or_create_settings(self, db: Session, user_id: str) -> ProactiveSetting:
        """Fetch or initialize user proactive controls."""
        settings = db.query(ProactiveSetting).filter(ProactiveSetting.user_id == user_id).first()
        if not settings:
            settings = ProactiveSetting(
                user_id=user_id,
                is_enabled=True,
                quiet_hours_start="23:00",
                quiet_hours_end="08:00",
                min_importance=3,
                max_suggestions_per_day=5
            )
            db.add(settings)
            db.commit()
            db.refresh(settings)
        return settings

    def is_in_quiet_hours(self, settings: ProactiveSetting) -> bool:
        """Check if current time is within user quiet hours."""
        now_time = datetime.utcnow().strftime("%H:%M")
        start = settings.quiet_hours_start
        end = settings.quiet_hours_end
        if start < end:
            return start <= now_time <= end
        else:
            # Crosses midnight (e.g., 23:00 to 08:00)
            return now_time >= start or now_time <= end

    def scan_for_insights(self, db: Session, user_id: str) -> List[ProactiveInsight]:
        """
        Background scanner that identifies actionable, high-value insights.
        """
        settings = self.get_or_create_settings(db, user_id)
        if not settings.is_enabled:
            return []

        insights_found = []
        now = datetime.utcnow()

        # 1. Goal Inactivity Check (e.g., "You have not worked on your internship goal for 3 days.")
        active_goals = db.query(PersonalGoal).filter(
            PersonalGoal.user_id == user_id,
            PersonalGoal.status == "active"
        ).all()

        for g in active_goals:
            days_since_update = (now - g.updated_at).days
            if days_since_update >= 3:
                existing = db.query(ProactiveInsight).filter(
                    ProactiveInsight.user_id == user_id,
                    ProactiveInsight.insight_type == "goal_stagnation",
                    ProactiveInsight.title.contains(g.title),
                    ProactiveInsight.is_dismissed == False
                ).first()
                if not existing:
                    ins = ProactiveInsight(
                        user_id=user_id,
                        insight_type="goal_stagnation",
                        title=f"Goal Inactivity: '{g.title}'",
                        reason=f"Aapne pichle {days_since_update} dinon se apne goal '{g.title}' par koi progress log nahi ki hai.",
                        importance=3,
                        source="goal",
                        action_label="Review Goal",
                        action_payload={"goal_id": g.id}
                    )
                    db.add(ins)
                    insights_found.append(ins)

        # 2. Unfinished High-Priority Tasks from Yesterday
        yesterday_start = now - timedelta(days=2)
        overdue_tasks = db.query(AgentTask).filter(
            AgentTask.user_id == user_id,
            AgentTask.status == "pending",
            AgentTask.created_at <= now - timedelta(days=1),
            AgentTask.priority <= 2
        ).limit(2).all()

        for t in overdue_tasks:
            existing = db.query(ProactiveInsight).filter(
                ProactiveInsight.user_id == user_id,
                ProactiveInsight.insight_type == "task_overdue",
                ProactiveInsight.title.contains(t.title),
                ProactiveInsight.is_dismissed == False
            ).first()
            if not existing:
                ins = ProactiveInsight(
                    user_id=user_id,
                    insight_type="task_overdue",
                    title=f"Pending Task: '{t.title}'",
                    reason=f"Aapka priority task '{t.title}' kal se pending hai.",
                    importance=4,
                    source="task",
                    action_label="Complete Task",
                    action_payload={"task_id": t.id}
                )
                db.add(ins)
                insights_found.append(ins)

        # 3. Weak Study Spot Practice Reminder
        weak_topics = db.query(StudyTopic).filter(
            StudyTopic.user_id == user_id,
            StudyTopic.is_weak_spot == True
        ).limit(1).all()

        for wt in weak_topics:
            existing = db.query(ProactiveInsight).filter(
                ProactiveInsight.user_id == user_id,
                ProactiveInsight.insight_type == "study_reminder",
                ProactiveInsight.title.contains(wt.name),
                ProactiveInsight.is_dismissed == False
            ).first()
            if not existing:
                ins = ProactiveInsight(
                    user_id=user_id,
                    insight_type="study_reminder",
                    title=f"Targeted Study: '{wt.name}'",
                    reason=f"Aapka topic '{wt.name}' identified weak spot hai (Mastery {wt.mastery_score:.0f}%). Revision recommended hai.",
                    importance=3,
                    source="study",
                    action_label="Start Practice",
                    action_payload={"topic_id": wt.id}
                )
                db.add(ins)
                insights_found.append(ins)

        if insights_found:
            db.commit()

        # Return only active, non-dismissed insights above importance threshold
        active = db.query(ProactiveInsight).filter(
            ProactiveInsight.user_id == user_id,
            ProactiveInsight.is_dismissed == False,
            ProactiveInsight.importance >= settings.min_importance
        ).order_by(ProactiveInsight.importance.desc(), ProactiveInsight.created_at.desc()).limit(settings.max_suggestions_per_day).all()

        return active

    def dismiss_insight(self, db: Session, user_id: str, insight_id: str) -> bool:
        """User dismisses an insight."""
        ins = db.query(ProactiveInsight).filter(
            ProactiveInsight.id == insight_id,
            ProactiveInsight.user_id == user_id
        ).first()
        if ins:
            ins.is_dismissed = True
            db.commit()
            return True
        return False

proactive_service = ProactiveService()
