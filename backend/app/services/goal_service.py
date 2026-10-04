import logging
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.goal import PersonalGoal, GoalMilestone
from app.models.task import AgentTask

logger = logging.getLogger("life.goals")

class GoalService:
    """
    Personal Goal & Milestone Management Engine:
    - Converts high-level user aspirations ("Crack internship in 3 months") into structured milestones and tasks.
    - Tracks progress, deadline proximity, and milestone completion.
    - Calculates the highest priority next action ("What should I do today?").
    """

    def create_goal_with_roadmap(
        self,
        db: Session,
        user_id: str,
        title: str,
        description: Optional[str] = None,
        category: str = "career",
        priority: int = 1,
        target_period_months: int = 3
    ) -> PersonalGoal:
        """
        Create a new goal and automatically generate standard milestones and first actionable tasks.
        """
        deadline = datetime.utcnow() + timedelta(days=target_period_months * 30)

        goal = PersonalGoal(
            user_id=user_id,
            title=title,
            description=description or f"Goal: {title}",
            category=category,
            priority=priority,
            status="active",
            progress=0.0,
            deadline=deadline,
            target_period=f"{target_period_months} months"
        )
        db.add(goal)
        db.commit()
        db.refresh(goal)

        # Standard milestone template based on category
        milestone_titles = []
        lower_title = title.lower()
        if "internship" in lower_title or "job" in lower_title or "placement" in lower_title:
            milestone_titles = [
                "1. Resume Preparation & ATS Polish",
                "2. Core DSA & Problem Solving (50+ LeetCode problems)",
                "3. Full-Stack / Core Domain Projects Completion",
                "4. Targeted Internship Applications (20+ companies)",
                "5. Mock Technical & HR Interviews"
            ]
        elif "learn" in lower_title or "study" in lower_title:
            milestone_titles = [
                "1. Foundational Syntax & Core Concepts",
                "2. Hands-on Mini Projects & Exercises",
                "3. Advanced Patterns & Architecture",
                "4. Capstone Portfolio Project"
            ]
        else:
            milestone_titles = [
                "1. Initial Planning & Architecture",
                "2. Core Implementation Sprint",
                "3. Testing, Polish & Review",
                "4. Launch & Retrospective"
            ]

        for i, m_title in enumerate(milestone_titles):
            m_deadline = datetime.utcnow() + timedelta(days=int((i + 1) * (target_period_months * 30 / len(milestone_titles))))
            milestone = GoalMilestone(
                goal_id=goal.id,
                user_id=user_id,
                title=m_title,
                order_index=i + 1,
                status="in_progress" if i == 0 else "pending",
                deadline=m_deadline
            )
            db.add(milestone)

        # Create first initial concrete actionable task in agent_tasks
        first_task = AgentTask(
            user_id=user_id,
            title=f"Begin {milestone_titles[0]} for '{title}'",
            description=f"Initial actionable step towards goal: {title}",
            status="pending",
            priority=priority,
            task_type="action",
            due_date=datetime.utcnow() + timedelta(days=7)
        )
        db.add(first_task)
        db.commit()
        db.refresh(goal)
        return goal

    def get_user_goals(self, db: Session, user_id: str, status: Optional[str] = None) -> List[PersonalGoal]:
        """Fetch all goals for user."""
        q = db.query(PersonalGoal).filter(PersonalGoal.user_id == user_id)
        if status:
            q = q.filter(PersonalGoal.status == status)
        return q.order_by(PersonalGoal.priority.asc(), PersonalGoal.created_at.desc()).all()

    def get_goal_by_id(self, db: Session, user_id: str, goal_id: str) -> Optional[PersonalGoal]:
        """Fetch single goal with milestones."""
        return db.query(PersonalGoal).filter(
            PersonalGoal.id == goal_id,
            PersonalGoal.user_id == user_id
        ).first()

    def get_next_recommended_step(self, db: Session, user_id: str) -> Dict[str, Any]:
        """
        Calculates the highest-priority next step across active goals and tasks:
        Answers: 'Mere goal ko complete karne ke liye next step kya hai?' or 'Aaj mujhe kya karna chahiye?'
        """
        # 1. Fetch highest priority active goal
        top_goal = db.query(PersonalGoal).filter(
            PersonalGoal.user_id == user_id,
            PersonalGoal.status.in_(["active", "in_progress"])
        ).order_by(PersonalGoal.priority.asc(), PersonalGoal.deadline.asc()).first()

        # 2. Fetch pending tasks
        pending_task = db.query(AgentTask).filter(
            AgentTask.user_id == user_id,
            AgentTask.status.in_(["pending", "in_progress"])
        ).order_by(AgentTask.priority.asc(), AgentTask.created_at.asc()).first()

        if not top_goal and not pending_task:
            return {
                "has_action": False,
                "recommendation": "Aapke paas filhal koi active goal ya pending task nahi hai. Ek naya goal create karein jaise 'Internship preparation' ya 'Learn JavaScript'!"
            }

        # Find the next pending milestone in top goal
        next_milestone = None
        if top_goal:
            next_milestone = db.query(GoalMilestone).filter(
                GoalMilestone.goal_id == top_goal.id,
                GoalMilestone.status.in_(["in_progress", "pending"])
            ).order_by(GoalMilestone.order_index.asc()).first()

        action_summary = []
        if top_goal:
            action_summary.append(f"Aapka main goal '{top_goal.title}' hai (Progress: {top_goal.progress:.0f}%).")
            if next_milestone:
                action_summary.append(f"Agla milestone: {next_milestone.title}.")
        if pending_task:
            action_summary.append(f"Highest priority pending task: '{pending_task.title}'.")

        return {
            "has_action": True,
            "goal": top_goal.title if top_goal else None,
            "next_milestone": next_milestone.title if next_milestone else None,
            "top_task": pending_task.title if pending_task else None,
            "recommendation": " ".join(action_summary)
        }

    def update_milestone_status(
        self,
        db: Session,
        user_id: str,
        milestone_id: str,
        new_status: str
    ) -> Optional[GoalMilestone]:
        """Update milestone status and re-calculate goal progress percentage."""
        m = db.query(GoalMilestone).filter(
            GoalMilestone.id == milestone_id,
            GoalMilestone.user_id == user_id
        ).first()
        if not m:
            return None

        m.status = new_status
        m.updated_at = datetime.utcnow()
        db.commit()

        # Recalculate parent goal progress
        all_milestones = db.query(GoalMilestone).filter(
            GoalMilestone.goal_id == m.goal_id
        ).all()
        if all_milestones:
            completed_count = sum(1 for item in all_milestones if item.status == "completed")
            goal = db.query(PersonalGoal).filter(PersonalGoal.id == m.goal_id).first()
            if goal:
                goal.progress = round((completed_count / len(all_milestones)) * 100, 1)
                if goal.progress >= 100.0:
                    goal.status = "completed"
                db.commit()
                db.refresh(goal)

        db.refresh(m)
        return m

goal_service = GoalService()
