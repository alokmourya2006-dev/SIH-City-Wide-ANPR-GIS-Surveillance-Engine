import hmac
import hashlib
import json
import os
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base

AuditBase = declarative_base()

class AuditLogDB(AuditBase):
    __tablename__ = "security_audit_logs"
    id = Column(Integer, primary_key=True)
    event_ts = Column(String)
    actor_id = Column(String)
    actor_role = Column(String)
    action = Column(String)
    resource_type = Column(String)
    resource_id = Column(String, nullable=True)
    outcome = Column(String)
    source_ip = Column(String, nullable=True)
    meta_json = Column(String, nullable=True)  # JSON string

# In production, load from environment variable
PLATE_HASH_KEY = os.getenv("PLATE_HASH_KEY", "sih_2026_plate_hash_key_lucknow")

def hash_plate(plate: str) -> str:
    """
    HMAC-SHA256 anonymization for cold storage.
    Deterministic matching without exposing raw plate values.
    """
    return hmac.new(
        PLATE_HASH_KEY.encode(),
        plate.upper().encode(),
        hashlib.sha256
    ).hexdigest()

def log_audit(
    db,
    actor_id: str,
    actor_role: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    outcome: str = "SUCCESS",
    source_ip: Optional[str] = None,
    metadata: Optional[dict] = None
):
    """
    Append-only audit log entry.
    """
    entry = AuditLogDB(
        event_ts=datetime.now(timezone.utc).isoformat(),
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        outcome=outcome,
        source_ip=source_ip,
        meta_json=json.dumps(metadata) if metadata else None
    )
    db.add(entry)
    db.commit()
    return entry.id