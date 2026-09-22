"""ARGUS dev launcher — reliably starts backend + frontend detached.

Usage:  python run_servers.py
Writes logs next to this file so startup problems are visible.
"""
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

# Prefer the project venv (fastapi/uvicorn/sqlalchemy/jwt + OCR stack all present)
PY = str(ROOT / "venv" / "Scripts" / "python.exe")
if not Path(PY).exists():
    PY = str(Path.home() / "AppData" / "Local" / "Python" / "pythoncore-3.14-64" / "python.exe")
if not Path(PY).exists():
    PY = sys.executable


def spawn(cmd, cwd, log_name):
    log = open(ROOT / log_name, "w", encoding="utf-8", errors="replace")
    flags = 0
    if os.name == "nt":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    proc = subprocess.Popen(
        cmd, cwd=str(cwd), stdout=log, stderr=subprocess.STDOUT,
        creationflags=flags, shell=False,
    )
    return proc


def main():
    be = spawn(
        [PY, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
        BACKEND, "backend-run.log",
    )
    print(f"backend pid={be.pid} -> backend-run.log")

    fe = spawn(
        ["cmd", "/c", "npm.cmd", "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173"],
        FRONTEND, "frontend-run.log",
    )
    print(f"frontend pid={fe.pid} -> frontend-run.log")

    time.sleep(10)
    print("\n--- backend-run.log ---")
    print((ROOT / "backend-run.log").read_text(encoding="utf-8", errors="replace")[-1500:])
    print("\n--- frontend-run.log ---")
    print((ROOT / "frontend-run.log").read_text(encoding="utf-8", errors="replace")[-1200:])


if __name__ == "__main__":
    main()
