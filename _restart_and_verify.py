"""Restart edge pipeline (post URL fix), verify frames flow + build. Writes _restart_out.txt"""
import subprocess, sys, os, json, time, urllib.request

root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []

# 1. Compile check after URL fix
r = subprocess.run([sys.executable, "-m", "py_compile", os.path.join(root, "backend", "edge_pipeline.py")],
                   capture_output=True, text=True)
out.append(f"COMPILE edge_pipeline: {'OK' if r.returncode == 0 else 'FAIL ' + r.stderr[-200:]}")

# 2. Kill any running edge_pipeline process
r = subprocess.run(["powershell", "-Command",
                    "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | "
                    "Where-Object { $_.CommandLine -match 'edge_pipeline' } | "
                    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force; $_.ProcessId }"],
                   capture_output=True, text=True, timeout=15)
killed = [l.strip() for l in r.stdout.strip().splitlines() if l.strip()]
out.append(f"KILLED OLD EDGE PROCESS: {killed or 'none running'}")

# 3. Restart edge pipeline (webcam, window shown, CAM_LKO_HAZRATGANJ_01)
subprocess.Popen(
    ["powershell", "-Command",
     "Start-Process python -ArgumentList 'edge_pipeline.py','--camera-id','CAM_LKO_HAZRATGANJ_01' "
     "-RedirectStandardOutput 'edge.log' -RedirectStandardError 'edge_err.log' -WindowStyle Hidden"],
    cwd=os.path.join(root, "backend"))
out.append("EDGE PIPELINE RESTARTED (loading models, ~60-90s on CPU)")

# 4. Frontend production build (robust capture)
r = subprocess.run("npm run build", shell=True, cwd=os.path.join(root, "frontend"),
                   capture_output=True, text=True, timeout=180)
build_tail = (r.stdout.strip().splitlines() or [""])[-6:]
out.append("--- NPM BUILD (exit=" + str(r.returncode) + ") ---")
out.extend(build_tail)

# 5. Poll status until ONLINE + stream_available (max 120s)
out.append("--- FRAME FLOW POLL ---")
online = False
deadline = time.time() + 120
req = urllib.request.Request("http://127.0.0.1:8000/api/v1/auth/login",
                             data=b"username=POLICE_7082&password=admin123",
                             headers={"Content-Type": "application/x-www-form-urlencoded"})
with urllib.request.urlopen(req, timeout=5) as resp:
    token = json.loads(resp.read())["access_token"]

while time.time() < deadline:
    time.sleep(10)
    try:
        req = urllib.request.Request("http://127.0.0.1:8000/api/v1/cameras/status",
                                     headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            cams = {c["camera_id"]: c for c in json.loads(resp.read())["cameras"]}
        hz = cams.get("CAM_LKO_HAZRATGANJ_01", {})
        state = f"status={hz.get('status')} stream_available={hz.get('stream_available')}"
        out.append(f"  poll: {state}")
        if hz.get("status") == "ONLINE" and hz.get("stream_available"):
            online = True
            break
    except Exception as e:
        out.append(f"  poll error: {e}")

out.append(f"RESULT: {'LIVE FRAMES FLOWING' if online else 'NOT YET LIVE (check edge_err.log)'}")
out.append(f"open browser: http://localhost:5173/")

with open(os.path.join(root, "_restart_out.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\n".join(out))
