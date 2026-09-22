@echo off
cd /d "C:\Users\Alok maurya\OneDrive\Desktop\SIH 127\backend"
REM Project venv now points at the current Python home (see venv\pyvenv.cfg).
"C:\Users\Alok maurya\OneDrive\Desktop\SIH 127\venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000