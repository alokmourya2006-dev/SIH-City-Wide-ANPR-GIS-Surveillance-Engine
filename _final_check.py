"""Final check: build output, edge pipeline process, live frame flow. Writes _final_out.txt"""
import subprocess, sys, os, json, urllib.request

root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []

def tail(path, n, label):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            lines = [l.rstrip() for l in fh.readlines()]
        out.append(f"--- {label} ---")
        out.extend(lines[-n:] if lines else ["(empty)"])
    except FileNotFoundError:
        out.append(f"--- {label} --- (not found)")

def tailcmd(path, n, label):
    p = os.path.join(root, path)
    try:
        r = subprocess.run(["powershell", "-Command", f"Get-Content '{p}' -Tail {n} -ErrorAction Stop"],
                           capture_output=True, text=True, timeout=10)
        out.append(f"--- {label} ---")
        out.append(r.stdout.strip() or "(empty)")
    except Exception as e:
        out.append(f"--- {label} --- read fail: {e}")

# Build result
tailcmd("_build_out.txt", 6, "FRONTEND BUILD")

# Edge pipeline logs
tailcmd("backend/edge.log", 15, "EDGE PIPELINE LOG")
tailcmd("backend/edge_err.log", 5, "EDGE ERR")

# Python processes running (edge_pipeline should be listed)
r = subprocess.run(["powershell", "-Command",
                    "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Select-Object -ExpandProperty CommandLine"],
                   capture_output=True, text=True, timeout=10)
out.append("--- PYTHON PROCESSES ---")
for line in r.stdout.strip().splitlines():
    if "edge_pipeline" in line or "uvicorn" in line:
        out.append(line.strip()[:120])

# Live frame flow: query camera status
try:
    req = urllib.request.Request("http://127.0.0.1:8000/api/v1/auth/login",
                                 data=b"username=POLICE_7082&password=admin123",
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urllib.request.urlopen(req, timeout=4) as resp:
        token = json.loads(resp.read())["access_token"]
    req = urllib.request.Request("http://127.0.0.1:8000/api/v1/cameras/status",
                                 headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=4) as resp:
        cams = json.loads(resp.read())["cameras"]
    out.append("--- LIVE FRAME FLOW ---")
    for c in cams:
        if c["status"] == "ONLINE" or c["stream_available"]:
            out.append(f"{c['camera_id']}: {c['status']} | stream_available={c['stream_available']}")
    hz = next((c for c in cams if c["camera_id"] == "CAM_LKO_HAZRATGANJ_01"), None)
    out.append(f"HAZRATGANJ -> status={hz['status']} stream_available={hz['stream_available']} hb={hz['last_heartbeat']}")
except Exception as e:
    out.append(f"LIVE FLOW check fail: {e}")

with open(os.path.join(root, "_final_out.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\n".join(out))
