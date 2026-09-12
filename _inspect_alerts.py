"""Inspect alerts table: count, duplicates, recent entries. Writes _alerts_out.txt"""
import sqlite3, os, json

root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
db_path = os.path.join(root, "backend", "surveillance.db")
out = []
con = sqlite3.connect(db_path)
cur = con.cursor()

try:
    total = cur.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
    out.append(f"TOTAL ALERTS: {total}")
except Exception as e:
    out.append(f"alerts table error: {e}")

try:
    rows = cur.execute("SELECT alert_type, plate_number, COUNT(*) c FROM alerts GROUP BY alert_type, plate_number ORDER BY c DESC").fetchall()
    out.append("--- GROUPED (type, plate, count) ---")
    for r in rows[:15]:
        out.append(f"  {r[0]} | {r[1]} | x{r[2]}")
except Exception as e:
    out.append(f"group error: {e}")

try:
    rows = cur.execute("SELECT id, alert_type, severity, plate_number, message, camera_id, timestamp FROM alerts ORDER BY id DESC LIMIT 10").fetchall()
    out.append("--- LAST 10 ALERTS ---")
    for r in rows:
        out.append(f"  #{r[0]} [{r[2]}] {r[1]} plate={r[3]} cam={r[5]} ts={r[6]}")
        out.append(f"      msg: {r[4]}")
except Exception as e:
    out.append(f"recent error: {e}")

try:
    th = cur.execute("SELECT COUNT(*) FROM telemetry_logs").fetchone()[0]
    out.append(f"TOTAL TELEMETRY ROWS: {th}")
    rows = cur.execute("SELECT plate_number, COUNT(*) c FROM telemetry_logs GROUP BY plate_number ORDER BY c DESC LIMIT 8").fetchall()
    out.append("--- TOP PLATES (telemetry) ---")
    for r in rows:
        out.append(f"  {r[0]!r} x{r[1]}")
except Exception as e:
    out.append(f"telemetry error: {e}")

con.close()
with open(os.path.join(root, "_alerts_out.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\n".join(out))
