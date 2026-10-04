import logging
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.services.tools.base import BaseTool, ToolCategory, RiskLevel, ToolExecutionResult
from app.models.task import AgentTask, AgentReminder

logger = logging.getLogger(__name__)

class TaskCreateInput(BaseModel):
    title: str = Field(description="Title of the task or goal to accomplish")
    description: Optional[str] = Field(default=None, description="Detailed instructions, context, or subtasks")
    priority: str = Field(default="medium", description="Priority level: low, medium, high, urgent")
    due_date: Optional[str] = Field(default=None, description="Optional due date in ISO format (YYYY-MM-DD) or human date")
    category: Optional[str] = Field(default="personal", description="Category: work, personal, study, coding, health")

class TaskCreateTool(BaseTool):
    name = "create_task"
    description = "Creates a persistent actionable task or goal in the user's task tracker."
    category = ToolCategory.ACTION
    risk_level = RiskLevel.LOW
    input_schema = TaskCreateInput

    def execute(self, user_id: str, args: TaskCreateInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            parsed_due = None
            if args.due_date:
                try:
                    parsed_due = datetime.fromisoformat(args.due_date.replace("Z", "+00:00"))
                except Exception:
                    pass

            pri_map = {"low": 1, "medium": 3, "high": 4, "urgent": 5}
            int_pri = pri_map.get(str(args.priority).lower(), 3)

            task = AgentTask(
                user_id=user_id,
                title=args.title,
                description=args.description,
                priority=int_pri,
                task_type=args.category or "action",
                due_date=parsed_due,
                status="pending"
            )
            db.add(task)
            db.commit()
            db.refresh(task)

            return ToolExecutionResult(
                success=True,
                data={
                    "task_id": task.id,
                    "title": task.title,
                    "priority": args.priority,
                    "status": task.status,
                    "created_at": task.created_at.isoformat() if task.created_at else None
                },
                source_attribution="task_planner"
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating task: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e)
            )

class TaskListInput(BaseModel):
    status: Optional[str] = Field(default=None, description="Filter by status: pending, in_progress, completed")
    limit: int = Field(default=10, description="Max number of tasks to return")

class TaskListTool(BaseTool):
    name = "list_tasks"
    description = "Lists existing tasks and their current progress or statuses."
    category = ToolCategory.ACTION
    risk_level = RiskLevel.READ_ONLY
    input_schema = TaskListInput

    def execute(self, user_id: str, args: TaskListInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            query = db.query(AgentTask).filter(AgentTask.user_id == user_id)
            if args.status:
                query = query.filter(AgentTask.status == args.status)
            tasks = query.order_by(desc(AgentTask.created_at)).limit(args.limit).all()

            results = [{
                "task_id": t.id,
                "title": t.title,
                "description": t.description,
                "status": t.status,
                "priority": t.priority,
                "due_date": t.due_date.isoformat() if t.due_date else None
            } for t in tasks]

            return ToolExecutionResult(
                success=True,
                data=results,
                source_attribution="task_planner"
            )
        except Exception as e:
            logger.error(f"Error listing tasks: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e),
                data=[]
            )

class ReminderCreateInput(BaseModel):
    title: str = Field(description="What the user needs to be reminded about")
    remind_at: str = Field(description="When the reminder should trigger (ISO format YYYY-MM-DDTHH:MM:SS or relative time)")
    repeat_interval: Optional[str] = Field(default=None, description="Optional recurrence: daily, weekly, monthly")

class ReminderCreateTool(BaseTool):
    name = "create_reminder"
    description = "Schedules a persistent reminder for the user at a specified date and time."
    category = ToolCategory.ACTION
    risk_level = RiskLevel.LOW
    input_schema = ReminderCreateInput

    def execute(self, user_id: str, args: ReminderCreateInput, db: Session, **kwargs) -> ToolExecutionResult:
        try:
            try:
                remind_dt = datetime.fromisoformat(args.remind_at.replace("Z", "+00:00"))
            except Exception:
                remind_dt = datetime.utcnow()

            reminder = AgentReminder(
                user_id=user_id,
                reminder_text=args.title,
                remind_at=remind_dt,
                is_triggered=False
            )
            db.add(reminder)
            db.commit()
            db.refresh(reminder)

            return ToolExecutionResult(
                success=True,
                data={
                    "reminder_id": reminder.id,
                    "title": reminder.reminder_text,
                    "remind_at": reminder.remind_at.isoformat()
                },
                source_attribution="reminder_service"
            )
        except Exception as e:
            db.rollback()
            logger.error(f"Error creating reminder: {e}")
            return ToolExecutionResult(
                success=False,
                error=str(e)
            )

class DestructiveActionInput(BaseModel):
    action: str = Field(description="Destructive action name to perform: e.g. delete_repository, clear_memories")
    target_id: str = Field(description="ID of the repository, document, or resource")
    confirm: bool = Field(default=False, description="Explicit confirmation from user (must be true to execute)")

class DestructiveActionTool(BaseTool):
    name = "perform_destructive_action"
    description = "Performs irreversible operations such as deleting repositories or wiping data. STRICT CONFIRMATION REQUIRED."
    category = ToolCategory.ACTION
    risk_level = RiskLevel.HIGH_DESTRUCTIVE
    input_schema = DestructiveActionInput

    def execute(self, user_id: str, args: DestructiveActionInput, db: Session, **kwargs) -> ToolExecutionResult:
        if not args.confirm:
            return ToolExecutionResult(
                success=False,
                requires_confirmation=True,
                confirmation_prompt=f"Are you sure you want to permanently execute '{args.action}' on '{args.target_id}'? Please reply 'yes' to confirm.",
                error="Action blocked pending user confirmation."
            )

        # Handle confirmed action
        return ToolExecutionResult(
            success=True,
            data={"status": "confirmed_and_executed", "action": args.action, "target_id": args.target_id},
            source_attribution="action_executor"
        )
