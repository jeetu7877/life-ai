import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.analytics import DailyBrief
from app.models.task import AgentTask
from app.models.goal import PersonalGoal, GoalMilestone
from app.models.timeline import DailyActivity
from app.models.study import StudySession
from app.services.goal_service import goal_service

logger = logging.getLogger("life.daily_brief")

class DailyBriefService:
    """
    Daily AI Brief Engine:
    Synthesizes stored data across Timeline, Tasks, Goals, and Study Sessions into a clean daily brief:
    - Yesterday's accomplishments
    - Today's top priorities
    - Urgent deadlines
    - Most valuable recommended action
    """

    def generate_brief(
        self,
        db: Session,
        user_id: str,
        user_name: str = "Jeet",
        brief_type: str = "morning"
    ) -> DailyBrief:
        """Generate and persist today's real brief."""
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        yesterday_str = (datetime.utcnow() - timedelta(days=1)).strftime("%Y-%m-%d")

        # 1. Accomplishments from yesterday
        yesterday_activities = db.query(DailyActivity).filter(
            DailyActivity.user_id == user_id,
            DailyActivity.activity_date == yesterday_str
        ).all()
        yesterday_tasks = db.query(AgentTask).filter(
            AgentTask.user_id == user_id,
            AgentTask.status == "completed",
            AgentTask.updated_at >= datetime.utcnow() - timedelta(days=1)
        ).all()

        summary_yesterday = [f"Completed: {t.title}" for t in yesterday_tasks] + [a.title for a in yesterday_activities]
        if not summary_yesterday:
            summary_yesterday = ["No specific activities logged yesterday."]

        # 2. Priorities for today
        pending_tasks = db.query(AgentTask).filter(
            AgentTask.user_id == user_id,
            AgentTask.status.in_(["pending", "in_progress"])
        ).order_by(AgentTask.priority.asc()).limit(4).all()

        priorities_today = [f"Priority {t.priority}: {t.title}" for t in pending_tasks]
        if not priorities_today:
            priorities_today = ["All scheduled tasks are up-to-date!"]

        # 3. Urgent deadlines (due within next 7 days)
        week_ahead = datetime.utcnow() + timedelta(days=7)
        urgent_tasks = db.query(AgentTask).filter(
            AgentTask.user_id == user_id,
            AgentTask.due_date != None,
            AgentTask.due_date <= week_ahead,
            AgentTask.status != "completed"
        ).all()
        urgent_milestones = db.query(GoalMilestone).filter(
            GoalMilestone.user_id == user_id,
            GoalMilestone.deadline != None,
            GoalMilestone.deadline <= week_ahead,
            GoalMilestone.status != "completed"
        ).all()

        deadlines = [f"{t.title} (due {t.due_date.strftime('%d %b')})" for t in urgent_tasks] + \
                    [f"Milestone: {m.title} (due {m.deadline.strftime('%d %b')})" for m in urgent_milestones]

        # 4. Recommendation
        rec_data = goal_service.get_next_recommended_step(db, user_id)
        recommendation = rec_data.get("recommendation", "Focus on key priorities for today.")

        # Persist or update today's brief
        brief = db.query(DailyBrief).filter(
            DailyBrief.user_id == user_id,
            DailyBrief.brief_date == today_str,
            DailyBrief.brief_type == brief_type
        ).first()

        if not brief:
            brief = DailyBrief(
                user_id=user_id,
                brief_type=brief_type,
                brief_date=today_str,
                summary_yesterday=summary_yesterday,
                priorities_today=priorities_today,
                urgent_deadlines=deadlines,
                recommendation=recommendation
            )
            db.add(brief)
        else:
            brief.summary_yesterday = summary_yesterday
            brief.priorities_today = priorities_today
            urgent_deadlines = deadlines
            brief.recommendation = recommendation

        db.commit()
        db.refresh(brief)
        return brief

    def format_brief_text(self, db: Session, user_id: str, user_name: str = "Jeet") -> str:
        """Formatted string representation suitable for Chat & Voice."""
        brief = self.generate_brief(db, user_id, user_name, "morning")
        greeting = f"Good morning {user_name} 👋\n\n"

        lines = [greeting]
        lines.append("📅 YESTERDAY:")
        for item in brief.summary_yesterday[:3]:
            lines.append(f"  • {item}")

        lines.append("\n🎯 TODAY'S TOP PRIORITIES:")
        for item in brief.priorities_today[:3]:
            lines.append(f"  • {item}")

        if brief.urgent_deadlines:
            lines.append("\n⚠️ UPCOMING DEADLINES:")
            for item in brief.urgent_deadlines[:2]:
                lines.append(f"  • {item}")

        lines.append(f"\n💡 RECOMMENDATION:\n  {brief.recommendation}")
        return "\n".join(lines)

daily_brief_service = DailyBriefService()
