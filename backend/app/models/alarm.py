import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, BigInteger, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class DeviceAlarm(Base):
    """
    User scheduled smart alarm persisted in database for multi-device sync and voice query history.
    """
    __tablename__ = "device_alarms"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    time_str = Column(String(30), nullable=False)  # e.g. "06:00 AM"
    timestamp_ms = Column(BigInteger, nullable=True)  # epoch trigger millis
    label = Column(String(120), default="Alarm")
    days = Column(JSON, default=list)  # ["Mon", "Tue", ...]
    enabled = Column(Boolean, default=True)
    sound = Column(Boolean, default=True)
    vibrate = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="device_alarms")
