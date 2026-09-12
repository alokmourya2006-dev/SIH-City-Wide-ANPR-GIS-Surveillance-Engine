"""Reboot backend only (main.py changed). Writes _reboot_out.txt"""
import subprocess, sys, os, time, urllib.request
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
APP = os.path.join(ROOT, "backend", "app")
LOG = os.path.join(ROOT, "backend_restart.log")
out = []
def log(s):
    print(s, flush=True); out.append(s)
r = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=10)
for line in r.stdout.splitlines():
    if ":8000" in line and "LISTENING" in line:
        parts = line.strip().split()
        if parts and parts[-1].isdigit():
            subprocess.run(["taskkill", "/F", "/PID", parts[-1]], capture_output=True, timeout=10)
            log(f"KILLED PID {parts[-1]} on :8000")
time.sleep(2)
bf = open(LOG, "w", encoding="utf-8")
subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app",
                  "--host", "127.0.0.1", "--port", "8000"],
                 cwd=APP, stdout=bf, stderr=subprocess.STDOUT,
                 creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
log("backend restarted")
for i in range(12):
    time.sleep(5)
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/docs", timeout=5) as resp:
            log(f"BACKEND UP ({resp.status})"); break
    except Exception as e:
        log(f"wait {(i+1)*5}s: {e}")
open(os.path.join(ROOT, "_reboot_out.txt"), "w", encoding="utf-8").write("\n".join(out))
