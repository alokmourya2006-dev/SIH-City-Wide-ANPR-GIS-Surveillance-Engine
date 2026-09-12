"""Start full system: ensure backend UP, start frontend if down, verify. Writes _start_out.txt"""
import subprocess, sys, os, time, urllib.request
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
APP = os.path.join(ROOT, "backend", "app")
FE = os.path.join(ROOT, "frontend")
BLOG = os.path.join(ROOT, "backend_restart.log")
FLOG = os.path.join(ROOT, "frontend_restart.log")
out = []
def log(s):
    print(s, flush=True); out.append(s)
def up(url):
    try:
        with urllib.request.urlopen(url, timeout=4) as r:
            return r.status
    except Exception:
        return 0
# 1. Backend check
s = up("http://127.0.0.1:8000/docs")
log(f"BACKEND :8000 -> {'UP '+str(s) if s else 'DOWN'}")
if not s:
    log("starting backend...")
    bf = open(BLOG, "w", encoding="utf-8")
    subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app",
                      "--host", "127.0.0.1", "--port", "8000"],
                     cwd=APP, stdout=bf, stderr=subprocess.STDOUT,
                     creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
    for i in range(12):
        time.sleep(5)
        s = up("http://127.0.0.1:8000/docs")
        if s:
            log(f"BACKEND UP ({s})"); break
        log(f"backend wait {(i+1)*5}s")
# 2. Frontend check
s = up("http://localhost:5173/")
log(f"FRONTEND :5173 -> {'UP '+str(s) if s else 'DOWN (stale log, restarting)'}")
if not s:
    r = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=10)
    for line in r.stdout.splitlines():
        if ":5173" in line and "LISTENING" in line:
            p = line.strip().split()
            if p and p[-1].isdigit():
                subprocess.run(["taskkill", "/F", "/PID", p[-1]], capture_output=True, timeout=10)
                log(f"KILLED stale PID {p[-1]} on :5173")
    time.sleep(2)
    ff = open(FLOG, "w", encoding="utf-8")
    subprocess.Popen("npm run dev -- --host --port 5173", cwd=FE,
                     stdout=ff, stderr=subprocess.STDOUT, shell=True,
                     creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
    log("frontend starting...")
    for i in range(12):
        time.sleep(5)
        s = up("http://localhost:5173/")
        if s:
            log(f"FRONTEND UP ({s})"); break
        log(f"frontend wait {(i+1)*5}s")
log("DASHBOARD http://localhost:5173/ | API http://127.0.0.1:8000/docs | LOGIN POLICE_7082/admin123")
open(os.path.join(ROOT, "_start_out.txt"), "w", encoding="utf-8").write("\n".join(out))
