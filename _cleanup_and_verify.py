"""Clean duplicate alerts + garbage telemetry, then restart backend & edge. Writes _cleanup_out.txt"""
import subprocess, sys, os, sqlite3, time, json, urllib.request

root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
db_path = os.path.join(root, "backend", "surveillance.db")
out = []

con = sqlite3.connect(db_path)
cur = con.cursor()

# 1. Dedupe alerts: keep newest id per (plate_number, camera_id)
cur.execute("""
    DELETE FROM alerts
    WHERE id NOT IN (
        SELECT MAX(id) FROM alerts GROUP BY plate_number, camera_id
    )
""")
out.append(f"DEDUPED ALERTS: {cur.rowcount} duplicate rows removed")
out.append(f"ALERTS REMAINING: {cur.execute('SELECT COUNT(*) FROM alerts').fetchone()[0]}")
for r in cur.execute("SELECT id, severity, plate_number, message, timestamp FROM alerts ORDER BY id DESC"):
    out.append(f"  #{r[0]} [{r[1]}] {r[2]} | {r[3][:60]} | {r[4]}")

# 2. Delete garbage telemetry (plate too short to be real)
cur.execute("DELETE FROM telemetry_logs WHERE LENGTH(TRIM(plate_number)) < 4")
out.append(f"GARBAGE TELEMETRY (<4 chars): {cur.rowcount} rows removed")

con.commit()
con.close()

# 3. Compile checks
for f in ["backend/app/main.py", "backend/edge_pipeline.py"]:
    r = subprocess.run([sys.executable, "-m", "py_compile", os.path.join(root, f)], capture_output=True, text=True)
    out.append(f"COMPILE {f}: {'OK' if r.returncode == 0 else 'FAIL ' + r.stderr[-200:]}")

# 4. Restart backend (uvicorn) — kill old, start new
subprocess.run(["powershell", "-Command",
                "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
                "Where-Object { $_.CommandLine -match 'uvicorn' } | "
                "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"], capture_output=True, timeout=15)
out.append("OLD BACKEND KILLED")
subprocess.Popen(
    ["powershell", "-Command",
     "Start-Process python -ArgumentList '-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000' "
     "-RedirectStandardOutput 'server.log' -RedirectStandardError 'server_err.log' -WindowStyle Hidden"],
    cwd=os.path.join(root, "backend"))
out.append("BACKEND RESTARTED")

# 5. Wait for health
for i in range(20):
    time.sleep(2)
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/docs", timeout=3) as resp:
            out.append(f"BACKEND HEALTHY after ~{(i+1)*2}s")
            break
    except Exception:
        pass

# 6. Live dedupe verification: ingest same hotlist plate twice
def post(url, data=None, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

import urllib.error
s, tok = post("http://127.0.0.1:8000/api/v1/auth/login",
              b"username=POLICE_7082&password=admin123",
              {"Content-Type": "application/x-www-form-urlencoded"})
H = {"Content-Type": "application/json", "Authorization": f"Bearer {tok['access_token']}"}
now = time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime())

s1, r1 = post("http://127.0.0.1:8000/api/v1/telemetry/ingest",
              json.dumps({"camera_id": "CAM_LKO_HAZRATGANJ_01", "plate_number": "UP32KT2112",
                          "vehicle_type": "SEDAN_CAR", "confidence": 0.91, "timestamp": now}).encode(), H)
out.append(f"INGEST #1: {s1} created={r1.get('alert_created')} suppressed={r1.get('alert_suppressed')}")
s2, r2 = post("http://127.0.0.1:8000/api/v1/telemetry/ingest",
              json.dumps({"camera_id": "CAM_LKO_CHARBAGH_02", "plate_number": "UP32KT2112",
                          "vehicle_type": "SEDAN_CAR", "confidence": 0.88, "timestamp": now}).encode(), H)
out.append(f"INGEST #2 (same plate, 10min window): {s2} created={r2.get('alert_created')} suppressed={r2.get('alert_suppressed')}")

s3, r3 = post("http://127.0.0.1:8000/api/v1/alerts", headers={"Authorization": f"Bearer {tok['access_token']}"})
out.append(f"ALERTS LIST: total={r3.get('total')} (newest first)")
for a in r3.get("alerts", [])[:5]:
    out.append(f"  #{a['id']} [{a['severity']}] {a['plate_number']} | {a['message'][:70]} | {a['timestamp']}")

ok = (r1.get("alert_created") is True and r2.get("alert_created") is False and r2.get("alert_suppressed") is True)
out.append(f"RESULT: {'DEDUPE VERIFIED' if ok else 'DEDUPE FAILED'}")

with open(os.path.join(root, "_cleanup_out.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\n".join(out))
