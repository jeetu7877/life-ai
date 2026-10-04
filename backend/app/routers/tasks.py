import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.task import AgentTask, AgentReminder
from app.models.tool_log import AgentToolLog
from app.security.dependencies import get_optional_user

logger = logging.getLogger("life.router.tasks")
router = APIRouter(prefix="/tasks", tags=["tasks"])

class TaskCreatePayload(BaseModel):
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    category: Optional[str] = "personal"
    due_date: Optional[datetime] = None

class TaskUpdatePayload(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None

class ReminderCreatePayload(BaseModel):
    title: str
    remind_at: datetime
    repeat_interval: Optional[str] = None

@router.get("")
def list_tasks(
    status: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    query = db.query(AgentTask).filter(AgentTask.user_id == user.id)
    if status:
        query = query.filter(AgentTask.status == status)
    tasks = query.order_by(desc(AgentTask.created_at)).limit(limit).all()
    return tasks

@router.post("")
def create_task(
    payload: TaskCreatePayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    pri_map = {"low": 1, "medium": 3, "high": 4, "urgent": 5}
    int_pri = pri_map.get(str(payload.priority).lower(), 3)
    task = AgentTask(
        user_id=user.id,
        title=payload.title,
        description=payload.description,
        priority=int_pri,
        task_type=payload.category or "action",
        due_date=payload.due_date,
        status="pending"
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.put("/{task_id}")
def update_task(
    task_id: str,
    payload: TaskUpdatePayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    task = db.query(AgentTask).filter(
        AgentTask.id == task_id,
        AgentTask.user_id == user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if payload.title is not None:
        task.title = payload.title
    if payload.description is not None:
        task.description = payload.description
    if payload.status is not None:
        task.status = payload.status
        if payload.status == "completed":
            task.completed_at = datetime.utcnow()
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.due_date is not None:
        task.due_date = payload.due_date

    db.commit()
    db.refresh(task)
    return task

@router.delete("/{task_id}")
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    task = db.query(AgentTask).filter(
        AgentTask.id == task_id,
        AgentTask.user_id == user.id
    ).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"status": "deleted", "id": task_id}

@router.get("/reminders/all")
def list_reminders(
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    reminders = db.query(AgentReminder).filter(
        AgentReminder.user_id == user.id
    ).order_by(AgentReminder.remind_at.asc()).all()
    return reminders

@router.post("/reminders")
def create_reminder(
    payload: ReminderCreatePayload,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    reminder = AgentReminder(
        user_id=user.id,
        reminder_text=payload.title,
        remind_at=payload.remind_at,
        is_triggered=False
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder

@router.get("/logs/audited")
def get_tool_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """Retrieve audited tool execution logs for monitoring and agent transparency."""
    logs = db.query(AgentToolLog).filter(
        AgentToolLog.user_id == user.id
    ).order_by(desc(AgentToolLog.created_at)).limit(limit).all()
    return [{
        "id": l.id,
        "tool_name": l.tool_name,
        "status": l.status,
        "execution_time_ms": l.execution_time_ms,
        "executed_at": l.created_at.isoformat() if l.created_at else None,
        "input_arguments": l.input_params,
        "output_result": l.output_result
    } for l in logs]
