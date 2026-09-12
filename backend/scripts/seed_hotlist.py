"""
Seed hotlist plates into the database for demo purposes.
Run from backend/ directory: python scripts/seed_hotlist.py
"""
import sys
import os

# Add backend to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.hotlist import HotlistDB, HotlistBase

SQLALCHEMY_DATABASE_URL = "sqlite:///./surveillance.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create hotlist table
HotlistBase.metadata.create_all(bind=engine)

HOTLIST_PLATES = [
    {"plate": "UP32KT2112", "reason": "Stolen vehicle - FIR #112/2026", "severity": "CRITICAL"},
    {"plate": "DL8CAF1234", "reason": "Wanted in hit-and-run case", "severity": "HIGH"},
    {"plate": "MH12AB5678", "reason": "Suspected smuggling network", "severity": "HIGH"},
    {"plate": "KA05MN9012", "reason": "Repeat traffic offender", "severity": "MEDIUM"},
]

def seed():
    db = SessionLocal()
    try:
        for item in HOTLIST_PLATES:
            existing = db.query(HotlistDB).filter(HotlistDB.plate_number == item["plate"]).first()
            if not existing:
                entry = HotlistDB(
                    plate_number=item["plate"],
                    reason=item["reason"],
                    severity=item["severity"]
                )
                db.add(entry)
                print(f"[SEED] Added {item['plate']} -> {item['reason']}")
            else:
                print(f"[SKIP] {item['plate']} already in hotlist")
        db.commit()
        print("[SEED] Hotlist seeding complete!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()