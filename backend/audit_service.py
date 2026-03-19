"""
Audit Log Service — tracks all user actions in the system.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from backend.database.models import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    username = Column(String(50), nullable=True)
    action = Column(String(50), nullable=False)  # CREATE, UPDATE, DELETE, LOGIN, VERIFY, PRINT, etc.
    entity_type = Column(String(50), nullable=True)  # patient, sample, result, invoice, etc.
    entity_id = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def log_action(db, user, action: str, entity_type: str = None, entity_id: str = None, details: str = None, ip: str = None):
    """Log an action to the audit trail."""
    entry = AuditLog(
        user_id=user.id if user else None,
        username=user.username if user else "system",
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else None,
        details=details,
        ip_address=ip,
    )
    db.add(entry)
    db.commit()
