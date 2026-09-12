"""Full system restart part 1: compile + kill stale + start backend/frontend."""
import subprocess, sys, os, time
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
BACKEND_APP = os.path.join(ROOT, "backend", "app")
FRONTEND = os.path.join(ROOT, "frontend")
BACKEND_LOG = os.path.join(ROOT, "backend_restart.log")
FRONTEND_LOG = os.path.join(ROOT, "frontend_restart.log")
out = []
def log(s):
    print(s, flush=True); out.append(s)
for f in ["backend/app/main.py", "backend/app/plate_detector.py",
          "backend/app/plate_localizer.py", "backend/app/tracker.py",
          "backend/edge_pipeline.py"]:
    r = subprocess.run([sys.executable, "-m", "py_compile", os.path.join(ROOT, f)],
                       capture_output=True, text=True)
    log(f"COMPILE {f}: {'OK' if r.returncode == 0 else 'FAIL ' + r.stderr[-300:]}")
def kill_port(port):
    try:
        r = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=10)
        pids = set()
        for line in r.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.strip().split()
                if parts and parts[-1].isdigit():
                    pids.add(int(parts[-1]))
        for pid in pids:
            subprocess.run(["taskkill", "/F", "/PID", str(pid)], capture_output=True, timeout=10)
            log(f"KILLED PID {pid} on port {port}")
        if not pids:
            log(f"No stale process on port {port}")
    except Exception as e:
        log(f"kill_port {port} warn: {e}")
kill_port(8000)
kill_port(5173)
try:
    r = subprocess.run(["powershell", "-NoProfile", "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { $_.CommandLine -match 'edge_pipeline' } | Select-Object -ExpandProperty ProcessId"],
        capture_output=True, text=True, timeout=15)
    for line in r.stdout.splitlines():
        line = line.strip()
        if line.isdigit() and int(line) != os.getpid():
            subprocess.run(["taskkill", "/F", "/PID", line], capture_output=True, timeout=10)
            log(f"KILLED old edge_pipeline PID {line}")
except Exception as e:
    log(f"edge kill warn: {e}")
time.sleep(2)
log("STARTING backend: python -m uvicorn main:app --host 127.0.0.1 --port 8000")
bf = open(BACKEND_LOG, "w", encoding="utf-8")
subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
                 cwd=BACKEND_APP, stdout=bf, stderr=subprocess.STDOUT,
                 creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
log(f"backend Popen OK, log -> {BACKEND_LOG}")
log("STARTING frontend: npm run dev -- --host --port 5173")
ff = open(FRONTEND_LOG, "w", encoding="utf-8")
subprocess.Popen("npm run dev -- --host --port 5173", cwd=FRONTEND,
                 stdout=ff, stderr=subprocess.STDOUT, shell=True,
                 creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
log(f"frontend Popen OK, log -> {FRONTEND_LOG}")
with open(os.path.join(ROOT, "_restart_part1.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("PART1 DONE")
