"""Delete all past event data: telemetry, alerts, tracklets, audit logs.
Keeps configuration (users, hotlist, cameras). Writes _purge_out.txt"""
import sqlite3, os, time, urllib.request, urllib.error, json

root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
db_path = os.path.join(root, "backend", "surveillance.db")
out = []

con = sqlite3.connect(db_path)
cur = con.cursor()

# Show all tables and row counts before purge
out.append("--- BEFORE PURGE ---")
tables = [r[0] for r in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
PURGE = ["telemetry_logs", "alerts", "tracklets", "audit_logs"]
KEEP = [t for t in tables if t not in PURGE]

for t in tables:
    try:
        n = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        out.append(f"  {t}: {n} rows")
    except Exception as e:
        out.append(f"  {t}: err {e}")

# Purge past event data
out.append("--- PURGING ---")
for t in PURGE:
    if t in tables:
        cur.execute(f"DELETE FROM {t}")
        out.append(f"  DELETED {cur.rowcount} rows from {t}")
    else:
        out.append(f"  SKIP {t} (table not found)")

con.commit()

# VACUUM to reclaim space
con.isolation_level = None
cur.execute("VACUUM")
con.isolation_level = None
out.append("  VACUUM OK")

out.append("--- AFTER PURGE ---")
for t in tables:
    try:
        n = cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        out.append(f"  {t}: {n} rows")
    except Exception as e:
        out.append(f"  {t}: err {e}")
con.close()

# Verify API still healthy after purge (login + endpoints respond)
out.append("--- API HEALTH ---")
def post(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

try:
    s, tok = post("http://127.0.0.1:8000/api/v1/auth/login",
                  b"username=POLICE_7082&password=admin123",
                  {"Content-Type": "application/x-www-form-urlencoded"})
    out.append(f"LOGIN: {s}")
    H = {"Authorization": f"Bearer {tok['access_token']}"}
    for url, label in [
        ("http://127.0.0.1:8000/api/v1/alerts", "ALERTS"),
        ("http://127.0.0.1:8000/api/v1/cameras/status", "CAMERA STATUS"),
        ("http://127.0.0.1:8000/api/v1/tracklets", "TRACKLETS"),
    ]:
        req = urllib.request.Request(url, headers=H)
        with urllib.request.urlopen(req, timeout=5) as resp:
            d = json.loads(resp.read())
        count = d.get("total", len(d.get("alerts", d.get("cameras", d.get("tracklets", [])))))
        out.append(f"{label}: {resp.status} total={count}")
except Exception as e:
    out.append(f"API check fail: {e}")

out.append("--- KEEPING (config) ---")
out.append("  users, hotlist, cameras registry: untouched")

with open(os.path.join(root, "_purge_out.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\n".join(out))
