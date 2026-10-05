import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.alarm import DeviceAlarm
from app.security.dependencies import get_current_user

router = APIRouter(prefix="/alarms", tags=["Alarms"])

class AlarmCreate(BaseModel):
    id: Optional[str] = None
    time_str: str
    timestamp_ms: Optional[int] = None
    label: Optional[str] = "Alarm"
    days: Optional[List[str]] = []
    enabled: Optional[bool] = True
    sound: Optional[bool] = True
    vibrate: Optional[bool] = True

class AlarmUpdate(BaseModel):
    time_str: Optional[str] = None
    timestamp_ms: Optional[int] = None
    label: Optional[str] = None
    days: Optional[List[str]] = None
    enabled: Optional[bool] = None
    sound: Optional[bool] = None
    vibrate: Optional[bool] = None

@router.get("")
def get_user_alarms(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Retrieve all smart alarms scheduled by the current user."""
    alarms = db.query(DeviceAlarm).filter(DeviceAlarm.user_id == user.id).order_by(DeviceAlarm.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "time_str": a.time_str,
            "timestamp_ms": a.timestamp_ms,
            "label": a.label,
            "days": a.days or [],
            "enabled": a.enabled,
            "sound": a.sound,
            "vibrate": a.vibrate,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "updated_at": a.updated_at.isoformat() if a.updated_at else None,
        }
        for a in alarms
    ]

@router.post("")
def create_or_upsert_alarm(
    data: AlarmCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Create a new alarm or update existing one by ID."""
    alarm_id = data.id or str(uuid.uuid4())
    existing = db.query(DeviceAlarm).filter(DeviceAlarm.id == alarm_id, DeviceAlarm.user_id == user.id).first()

    if existing:
        existing.time_str = data.time_str
        if data.timestamp_ms is not None:
            existing.timestamp_ms = data.timestamp_ms
        if data.label is not None:
            existing.label = data.label
        if data.days is not None:
            existing.days = data.days
        if data.enabled is not None:
            existing.enabled = data.enabled
        if data.sound is not None:
            existing.sound = data.sound
        if data.vibrate is not None:
            existing.vibrate = data.vibrate
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        target = existing
    else:
        target = DeviceAlarm(
            id=alarm_id,
            user_id=user.id,
            time_str=data.time_str,
            timestamp_ms=data.timestamp_ms,
            label=data.label or "Alarm",
            days=data.days or [],
            enabled=data.enabled if data.enabled is not None else True,
            sound=data.sound if data.sound is not None else True,
            vibrate=data.vibrate if data.vibrate is not None else True,
        )
        db.add(target)
        db.commit()
        db.refresh(target)

    return {
        "id": target.id,
        "time_str": target.time_str,
        "timestamp_ms": target.timestamp_ms,
        "label": target.label,
        "days": target.days or [],
        "enabled": target.enabled,
        "sound": target.sound,
        "vibrate": target.vibrate,
        "created_at": target.created_at.isoformat() if target.created_at else None,
        "updated_at": target.updated_at.isoformat() if target.updated_at else None,
    }

@router.put("/{alarm_id}")
def update_alarm(
    alarm_id: str,
    data: AlarmUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Update settings of an existing alarm."""
    alarm = db.query(DeviceAlarm).filter(DeviceAlarm.id == alarm_id, DeviceAlarm.user_id == user.id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")

    if data.time_str is not None:
        alarm.time_str = data.time_str
    if data.timestamp_ms is not None:
        alarm.timestamp_ms = data.timestamp_ms
    if data.label is not None:
        alarm.label = data.label
    if data.days is not None:
        alarm.days = data.days
    if data.enabled is not None:
        alarm.enabled = data.enabled
    if data.sound is not None:
        alarm.sound = data.sound
    if data.vibrate is not None:
        alarm.vibrate = data.vibrate

    alarm.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(alarm)

    return {
        "id": alarm.id,
        "time_str": alarm.time_str,
        "timestamp_ms": alarm.timestamp_ms,
        "label": alarm.label,
        "days": alarm.days or [],
        "enabled": alarm.enabled,
        "sound": alarm.sound,
        "vibrate": alarm.vibrate,
        "created_at": alarm.created_at.isoformat() if alarm.created_at else None,
        "updated_at": alarm.updated_at.isoformat() if alarm.updated_at else None,
    }

@router.delete("/{alarm_id}")
def delete_alarm(
    alarm_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Delete an alarm."""
    alarm = db.query(DeviceAlarm).filter(DeviceAlarm.id == alarm_id, DeviceAlarm.user_id == user.id).first()
    if not alarm:
        raise HTTPException(status_code=404, detail="Alarm not found")

    db.delete(alarm)
    db.commit()
    return {"success": True, "deleted_id": alarm_id}
