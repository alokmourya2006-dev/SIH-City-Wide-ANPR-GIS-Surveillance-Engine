"""Frontend ensure-UP only (backend already UP). Writes _start_fe.txt"""
import subprocess, sys, os, time, urllib.request
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
FE = os.path.join(ROOT, "frontend")
FLOG = os.path.join(ROOT, "frontend_restart.log")
out = []
def log(s):
    print(s, flush=True); out.append(s)
    open(os.path.join(ROOT, "_start_fe.txt"), "w", encoding="utf-8").write("\n".join(out))
def up(url):
    try:
        with urllib.request.urlopen(url, timeout=4) as r:
            return r.status
    except Exception as e:
        return f"DOWN {e}"
s = up("http://127.0.0.1:8000/docs")
log(f"BACKEND :8000 -> {s}")
s = up("http://localhost:5173/")
log(f"FRONTEND :5173 -> {s}")
if s != 200:
    r = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=10)
    for line in r.stdout.splitlines():
        if ":5173" in line and "LISTENING" in line:
            p = line.strip().split()
            if p and p[-1].isdigit():
                subprocess.run(["taskkill", "/F", "/PID", p[-1]], capture_output=True, timeout=10)
                log(f"KILLED stale PID {p[-1]} on :5173")
    time.sleep(2)
    ff = open(FLOG, "w", encoding="utf-8")
    vite_js = os.path.join(FE, "node_modules", "vite", "bin", "vite.js")
    subprocess.Popen(["node", vite_js, "--host", "--port", "5173"], cwd=FE,
                     stdout=ff, stderr=subprocess.STDOUT,
                     creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
    log("frontend starting, polling 60s...")
    for i in range(12):
        time.sleep(5)
        s = up("http://localhost:5173/")
        if s == 200:
            log("FRONTEND UP (200)"); break
        log(f"wait {(i+1)*5}s: {s}")
log("DASHBOARD http://localhost:5173/ | API http://127.0.0.1:8000/docs")
