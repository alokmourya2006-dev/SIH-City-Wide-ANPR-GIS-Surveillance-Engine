"""Backend ensure-UP (was rebooted by _start_system but check now). Writes _start_be.txt"""
import subprocess, sys, os, time, urllib.request
ROOT = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
APP = os.path.join(ROOT, "backend", "app")
BLOG = os.path.join(ROOT, "backend_restart.log")
out = []
def log(s):
    print(s, flush=True); out.append(s)
    open(os.path.join(ROOT, "_start_be.txt"), "w", encoding="utf-8").write("\n".join(out))
def up():
    try:
        with urllib.request.urlopen("http://127.0.0.1:8000/docs", timeout=4) as r:
            return r.status
    except Exception as e:
        return f"DOWN {e}"
s = up()
log(f"BACKEND :8000 -> {s}")
if s != 200:
    log("restarting backend...")
    bf = open(BLOG, "w", encoding="utf-8")
    subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app",
                      "--host", "127.0.0.1", "--port", "8000"],
                     cwd=APP, stdout=bf, stderr=subprocess.STDOUT,
                     creationflags=subprocess.CREATE_NEW_PROCESS_GROUP)
    for i in range(12):
        time.sleep(5)
        s = up()
        if s == 200:
            log("BACKEND UP (200)"); break
        log(f"wait {(i+1)*5}s: {s}")
log("API docs http://127.0.0.1:8000/docs")
