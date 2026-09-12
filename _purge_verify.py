"""Verify purge completion; delete audit logs + stray cameras if still present."""
import sqlite3, os

db = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127\backend\surveillance.db"
con = sqlite3.connect(db)
cur = con.cursor()

# Ensure audit logs cleared
cur.execute("DELETE FROM security_audit_logs")
print("audit cleared, rows removed:", cur.rowcount)

# Remove any stray test cameras (keep the 4 real Lucknow nodes)
keep = ("CAM_LKO_HAZRATGANJ_01", "CAM_LKO_CHARBAGH_02", "CAM_LKO_ALAMBAGH_03", "CAM_LKO_GOMTINAGAR_04")
rows = cur.execute("SELECT camera_id FROM cameras").fetchall()
for (cid,) in rows:
    if cid not in keep:
        cur.execute("DELETE FROM cameras WHERE camera_id=?", (cid,))
        print("removed stray camera:", cid)

con.commit()

print("--- FINAL TABLE COUNTS ---")
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
for t in tables:
    n = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    print(f"  {t}: {n}")
con.close()
print("PURGE COMPLETE")
