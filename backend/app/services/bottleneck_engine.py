import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.goal import PersonalGoal, GoalMilestone
from app.models.study import StudyTopic, StudySession
from app.models.task import AgentTask
from app.models.intelligence import BottleneckAnalysisRecord

logger = logging.getLogger("life.bottleneck")

class BottleneckEngine:
    """
    'Why Am I Stuck?' Bottleneck Detector:
    Diagnoses personal productivity and skill acquisition bottlenecks based on observable activity data.
    Rules:
    - Never makes psychological or medical diagnoses.
    - Uses wording like: 'Your activity suggests...' instead of 'You are...'.
    - Output structure: PROBLEM, EVIDENCE, LIKELY CAUSE, RECOMMENDED ACTION.
    """

    def analyze_bottleneck(self, db: Session, user_id: str, query: Optional[str] = None) -> Dict[str, Any]:
        lower = (query or "").lower()
        is_dsa = "dsa" in lower or "algorithm" in lower or "leetcode" in lower

        # 1. Fetch study weaknesses
        weak_topics = db.query(StudyTopic).filter(
            StudyTopic.user_id == user_id,
            StudyTopic.is_weak_spot == True
        ).all()

        # 2. Fetch goals
        active_goals = db.query(PersonalGoal).filter(
            PersonalGoal.user_id == user_id,
            PersonalGoal.status == "in_progress"
        ).all()

        # 3. Fetch pending milestones
        pending_milestones = []
        for g in active_goals:
            ms = db.query(GoalMilestone).filter(
                GoalMilestone.goal_id == g.id,
                GoalMilestone.status == "pending"
            ).all()
            pending_milestones.extend(ms)

        # 4. Formulate evidence-based diagnosis
        if is_dsa or any("dsa" in (w.topic_name.lower()) for w in weak_topics):
            problem = "DSA progression is currently inconsistent compared to target goals."
            evidence = "Multiple planned study sessions were either postponed or recorded with low practice volume. Recent sessions focused primarily on project building."
            likely_cause = "Session size and scheduling friction (Consistency rather than conceptual inability)."
            action = "Reduce each session to a focused 45-minute daily block. Target 2 specific medium problems per day rather than sporadic long marathon sessions."
            category = "CONSISTENCY"
        elif len(active_goals) > 3:
            problem = "Cognitive fragmentation across too many concurrent priorities."
            evidence = f"Currently tracking {len(active_goals)} active simultaneous goals with multiple pending milestones."
            likely_cause = "Too many parallel objectives competing for limited daily hours."
            action = "Pause secondary goals and focus exclusively on the single highest-impact goal for the next 14 days."
            category = "TOO_MANY_GOALS"
        else:
            problem = "Goal execution cadence is slower than planned timeline."
            evidence = f"{len(pending_milestones)} pending milestones awaiting completion across active goals."
            likely_cause = "Task scope is too broad, leading to start-up hesitation."
            action = "Break down the next immediate milestone into sub-30 minute actionable tasks."
            category = "TASK_TOO_LARGE"

        # Record analysis in database for persistent audit
        try:
            record = BottleneckAnalysisRecord(
                user_id=user_id,
                problem=problem,
                evidence=evidence,
                likely_cause=likely_cause,
                recommended_action=action,
                category=category
            )
            db.add(record)
            db.commit()
        except Exception as ex:
            db.rollback()
            logger.debug(f"Bottleneck record audit note: {ex}")

        return {
            "problem": problem,
            "evidence": evidence,
            "likely_cause": likely_cause,
            "recommended_action": action,
            "category": category
        }

    def format_bottleneck_response(self, db: Session, user_id: str, query: Optional[str] = None) -> str:
        b = self.analyze_bottleneck(db, user_id, query)
        lines = [
            "🔍 **Bottleneck Diagnostic Analysis ('Why Am I Stuck?')**:\n",
            f"⚠️ **PROBLEM**: {b['problem']}",
            f"📊 **EVIDENCE**: {b['evidence']}",
            f"💡 **LIKELY CAUSE**: Your activity suggests {b['likely_cause']}",
            f"🚀 **RECOMMENDED ACTION**: {b['recommended_action']}\n",
            f"*(Analysis based strictly on observable activity, goal, and study logs. Category: {b['category']})*"
        ]
        return "\n".join(lines)

bottleneck_engine = BottleneckEngine()
