"""Remove stale demo alerts, restart edge pipeline, validate build. Writes _final2_out.txt"""
import subprocess, sys, os, sqlite3, time, urllib.request

root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []

# 1. Delete stale demo alerts (old message format from mock_traffic_gen)
db_path = os.path.join(root, "backend", "surveillance.db")
con = sqlite3.connect(db_path)
cur = con.cursor()
cur.execute("DELETE FROM alerts WHERE message LIKE 'Hotlist match:%'")
out.append(f"STALE DEMO ALERTS REMOVED: {cur.rowcount}")
out.append(f"ALERTS REMAINING: {cur.execute('SELECT COUNT(*) FROM alerts').fetchone()[0]}")
for r in cur.execute("SELECT id, severity, plate_number, message, timestamp FROM alerts ORDER BY id DESC"):
    out.append(f"  #{r[0]} [{r[1]}] {r[2]} | {r[3][:65]} | {r[4]}")
con.commit()
con.close()

# 2. Restart edge pipeline (picks up garbage-plate guard)
subprocess.run(["powershell", "-Command",
                "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
                "Where-Object { $_.CommandLine -match 'edge_pipeline' } | "
                "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"], capture_output=True, timeout=15)
out.append("OLD EDGE KILLED")
subprocess.Popen(
    ["powershell", "-Command",
     "Start-Process python -ArgumentList 'edge_pipeline.py','--camera-id','CAM_LKO_HAZRATGANJ_01' "
     "-RedirectStandardOutput 'edge.log' -RedirectStandardError 'edge_err.log' -WindowStyle Hidden"],
    cwd=os.path.join(root, "backend"))
out.append("EDGE RESTARTED (models loading ~60-90s)")

# 3. Validate frontend build
r = subprocess.run("npm run build", shell=True, cwd=os.path.join(root, "frontend"),
                   capture_output=True, text=True, timeout=180)
tail = (r.stdout.strip().splitlines() or [""])[-4:]
out.append(f"NPM BUILD exit={r.returncode}")
out.extend(tail)

# 4. Health: backend + frontend
for url, label in [("http://127.0.0.1:8000/docs", "BACKEND"), ("http://localhost:5173/", "FRONTEND")]:
    try:
        with urllib.request.urlopen(url, timeout=4) as resp:
            out.append(f"{label}: UP ({resp.status})")
    except Exception as e:
        out.append(f"{label}: DOWN ({e})")

out.append("browser: http://localhost:5173/")

with open(os.path.join(root, "_final2_out.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\n".join(out))
