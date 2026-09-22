@echo off
REM ARGUS frontend launcher — Vite dev server on 127.0.0.1:5173
cd /d "%~dp0frontend"
call npm.cmd run dev -- --host 127.0.0.1 --port 5173
