"""Verify: compile, server health, full stream smoke test. Writes _verify_out.txt"""
import subprocess, sys, os

root = r"c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
out = []

# 1. Compile checks
for f in ["backend/app/main.py", "backend/app/stream_manager.py", "backend/app/models.py", "backend/edge_pipeline.py"]:
    r = subprocess.run([sys.executable, "-m", "py_compile", os.path.join(root, f)], capture_output=True, text=True)
    out.append(f"COMPILE {f}: {'OK' if r.returncode == 0 else 'FAIL ' + r.stderr[-300:]}")

# 2. Server health
import urllib.request, urllib.error
try:
    with urllib.request.urlopen("http://127.0.0.1:8000/docs", timeout=4) as resp:
        out.append(f"SERVER 8000: UP ({resp.status})")
    server_up = True
except Exception as e:
    out.append(f"SERVER 8000: DOWN ({e})")
    server_up = False

# 3. If server up, run smoke test
if server_up:
    r = subprocess.run([sys.executable, os.path.join(root, "backend", "_smoke_stream.py")],
                       capture_output=True, text=True, timeout=60)
    out.append("--- SMOKE TEST ---")
    out.append(r.stdout.strip() or r.stderr.strip()[-600:])

# 4. Frontend health
try:
    with urllib.request.urlopen("http://localhost:5173/", timeout=4) as resp:
        out.append(f"FRONTEND 5173: UP ({resp.status})")
except Exception as e:
    out.append(f"FRONTEND 5173: DOWN ({e})")

with open(os.path.join(root, "_verify_out.txt"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(out))
print("\n".join(out))
