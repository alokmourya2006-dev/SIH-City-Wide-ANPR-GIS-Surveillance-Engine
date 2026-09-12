import os
import sys
import subprocess

os.chdir(r"C:\Users\Alok maurya\OneDrive\Desktop\SIH 127\backend")
r = subprocess.run([sys.executable, "-m", "py_compile", "app/main.py", "app/models.py", "app/stream_manager.py"], capture_output=True, text=True)
out = f"COMPILE EXIT={r.returncode}\n{(r.stderr or '')[-2000:]}"

with open(r"C:\Users\Alok maurya\OneDrive\Desktop\SIH 127\compile_out.txt", "w") as f:
    f.write(out)