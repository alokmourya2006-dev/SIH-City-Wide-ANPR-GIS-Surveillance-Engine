from typing import Optional

from sqlalchemy import Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base

HotlistBase = declarative_base()

class HotlistDB(HotlistBase):
    __tablename__ = "hotlist"
    id = Column(Integer, primary_key=True)
    plate_number = Column(String, index=True)
    reason = Column(String)
    severity = Column(String, default="HIGH")
    added_at = Column(String)

def check_hotlist(db, plate_number: str) -> Optional[dict]:
    """
    Check if a plate is on the hotlist.
    Returns alert info if found, None otherwise.
    """
    plate = plate_number.upper()
    result = db.query(HotlistDB).filter(HotlistDB.plate_number == plate).first()
    
    if result:
        return {
            "plate_number": result.plate_number,
            "reason": result.reason,
            "severity": result.severity
        }
    return None

def add_to_hotlist(db, plate_number: str, reason: str, severity: str = "HIGH") -> int:
    """
    Add a plate to the hotlist.
    """
    from datetime import datetime, timezone
    
    entry = HotlistDB(
        plate_number=plate_number.upper(),
        reason=reason,
        severity=severity,
        added_at=datetime.now(timezone.utc).isoformat()
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry.id

def remove_from_hotlist(db, plate_number):
    plate = plate_number.upper()
    entry = db.query(HotlistDB).filter(HotlistDB.plate_number == plate).first()
    if not entry:
        return False
    db.delete(entry)
    db.commit()
    return True