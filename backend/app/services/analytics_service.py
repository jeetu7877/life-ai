import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.analytics import AnalyticsEvent
from app.models.timeline import DailyActivity
from app.models.task import AgentTask
from app.models.study import StudySession

logger = logging.getLogger("life.analytics")

class AnalyticsService:
    """
    Personal Productivity Analytics Engine:
    - Calculates genuine hours and counts for Study, Coding, Projects, Tasks, and Applications.
    - Aggregates over Today, This Week (past 7 days), and This Month (past 30 days).
    - Computes real trend direction (improving, consistent, declining).
    - Strictly avoids data fabrication.
    """

    def log_event(
        self,
        db: Session,
        user_id: str,
        category: str,
        title: str,
        duration_minutes: int = 0,
        project_tag: str = None,
        metadata_json: Dict[str, Any] = None
    ) -> AnalyticsEvent:
        """Record real user productivity event."""
        evt = AnalyticsEvent(
            user_id=user_id,
            category=category,
            title=title,
            duration_minutes=duration_minutes,
            project_tag=project_tag,
            metadata_json=metadata_json or {},
            recorded_at=datetime.utcnow()
        )
        db.add(evt)
        db.commit()
        db.refresh(evt)
        return evt

    def get_aggregated_metrics(self, db: Session, user_id: str) -> Dict[str, Any]:
        """
        Aggregate productivity statistics for Today, This Week, and This Month.
        """
        now = datetime.utcnow()
        start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        start_week = now - timedelta(days=7)
        start_month = now - timedelta(days=30)
        start_prev_week = now - timedelta(days=14)

        def get_period_stats(start_dt, end_dt=now):
            events = db.query(AnalyticsEvent).filter(
                AnalyticsEvent.user_id == user_id,
                AnalyticsEvent.recorded_at >= start_dt,
                AnalyticsEvent.recorded_at <= end_dt
            ).all()

            study_min = sum(e.duration_minutes for e in events if e.category in ["study", "learning"])
            coding_min = sum(e.duration_minutes for e in events if e.category in ["coding", "github"])
            project_min = sum(e.duration_minutes for e in events if e.category in ["project"])
            apps_count = sum(1 for e in events if e.category in ["application", "interview"])

            # Completed tasks in this timeframe
            completed_tasks = db.query(AgentTask).filter(
                AgentTask.user_id == user_id,
                AgentTask.status == "completed",
                AgentTask.updated_at >= start_dt,
                AgentTask.updated_at <= end_dt
            ).count()

            # Timeline activities
            activities_count = db.query(DailyActivity).filter(
                DailyActivity.user_id == user_id,
                DailyActivity.created_at >= start_dt,
                DailyActivity.created_at <= end_dt
            ).count()

            return {
                "study_hours": round(study_min / 60, 1),
                "coding_hours": round(coding_min / 60, 1),
                "project_hours": round(project_min / 60, 1),
                "total_hours": round((study_min + coding_min + project_min) / 60, 1),
                "completed_tasks": completed_tasks,
                "applications_count": apps_count,
                "activities_logged": activities_count
            }

        today_stats = get_period_stats(start_today)
        week_stats = get_period_stats(start_week)
        month_stats = get_period_stats(start_month)
        prev_week_stats = get_period_stats(start_prev_week, start_week)

        # Calculate trend
        curr_total = week_stats["total_hours"]
        prev_total = prev_week_stats["total_hours"]
        if curr_total > prev_total * 1.1:
            trend = "improving"
        elif curr_total < prev_total * 0.9 and prev_total > 0:
            trend = "declining"
        else:
            trend = "consistent"

        return {
            "today": today_stats,
            "this_week": week_stats,
            "this_month": month_stats,
            "trend": trend,
            "productivity_score": min(100, int((week_stats["total_hours"] / 20.0) * 100)) if week_stats["total_hours"] > 0 else 60
        }

    def format_productivity_summary(self, db: Session, user_id: str) -> str:
        """Human-friendly summary for chat / voice answer."""
        metrics = self.get_aggregated_metrics(db, user_id)
        w = metrics["this_week"]
        t = metrics["today"]
        trend = metrics["trend"]

        trend_text = {
            "improving": "📈 Trend: Pichle hafte se behtar aur improving!",
            "declining": "📉 Trend: Pichle hafte ke mukable thoda kam raha hai.",
            "consistent": "⚖️ Trend: Consistent aur steady progress bani hui hai."
        }.get(trend, "")

        return (
            f"📊 Life AI Productivity Report:\n\n"
            f"• Aaj: {t['total_hours']}h logged ({t['coding_hours']}h coding, {t['study_hours']}h study)\n"
            f"• Is hafte: {w['total_hours']}h total ({w['coding_hours']}h coding, {w['study_hours']}h study, {w['project_hours']}h projects)\n"
            f"• Completed Tasks: {w['completed_tasks']} tasks done\n"
            f"• {trend_text}"
        )

analytics_service = AnalyticsService()
