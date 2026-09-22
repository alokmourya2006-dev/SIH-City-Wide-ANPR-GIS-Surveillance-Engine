@echo off
cd /d "C:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
rem Detached console + internal redirect so the log is written AND the
rem process survives the launching shell closing its console.
"C:\Users\Alok maurya\OneDrive\Desktop\SIH 127\venv\Scripts\python.exe" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 > "C:\Users\Alok maurya\OneDrive\Desktop\SIH 127\backend-run.log" 2>&1

