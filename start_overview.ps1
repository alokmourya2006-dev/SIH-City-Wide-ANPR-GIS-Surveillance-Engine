# ARGUS - SIH 127 Overview Starter (PowerShell)
# Run: powershell -ExecutionPolicy Bypass -File start_overview.ps1
$ROOT = "c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
$BACKEND = Join-Path $ROOT "backend\app"
$FRONTEND = Join-Path $ROOT "frontend"

Write-Host "=== ARGUS Overview Startup ===" -ForegroundColor Cyan
Write-Host "Root: $ROOT"

# 1. Kill stale servers on 8000 / 5173 (best effort)
try {
  $conns = Get-NetTCPConnection -LocalPort 8000,5173 -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $proc = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) { Write-Host "Stopping stale $($proc.ProcessName) PID $($proc.Id) on port $($c.LocalPort)"; Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  }
} catch { Write-Host "(skip port cleanup: $_)" }

Start-Sleep -Seconds 1

# 2. Start Backend (FastAPI + Uvicorn) detached, log to backend_overview.log
$backendLog = Join-Path $ROOT "backend_overview.log"
$backendCmd = "cd '$BACKEND'; python -m uvicorn main:app --host 127.0.0.1 --port 8000"
Write-Host "Starting backend: $backendCmd" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command", $backendCmd -WindowStyle Normal -WorkingDirectory $BACKEND

# 3. Start Frontend (Vite) detached
$frontendCmd = "cd '$FRONTEND'; npm run dev -- --host --port 5173"
Write-Host "Starting frontend: $frontendCmd" -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command", $frontendCmd -WindowStyle Normal -WorkingDirectory $FRONTEND

Write-Host ""
Write-Host "Waiting 8s for servers to boot..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

# 4. Health checks
try { $b = Invoke-WebRequest -Uri "http://127.0.0.1:8000/docs" -TimeoutSec 5 -UseBasicParsing; Write-Host "Backend 8000: UP ($($b.StatusCode)) -> http://127.0.0.1:8000/docs" -ForegroundColor Green } catch { Write-Host "Backend 8000: NOT YET UP ($_). Check backend window for uvicorn logs." -ForegroundColor Red }
try { $f = Invoke-WebRequest -Uri "http://localhost:5173/" -TimeoutSec 5 -UseBasicParsing; Write-Host "Frontend 5173: UP ($($f.StatusCode)) -> http://localhost:5173/" -ForegroundColor Green } catch { Write-Host "Frontend 5173: NOT YET UP ($_). Check frontend window for vite logs." -ForegroundColor Red }

Write-Host ""
Write-Host "=== OVERVIEW URLS ===" -ForegroundColor Cyan
Write-Host "Dashboard (React) : http://localhost:5173/"
Write-Host "Backend API docs  : http://127.0.0.1:8000/docs"
Write-Host "Login             : Badge POLICE_7082 / Password admin123"
Write-Host "Live edge (optional): cd backend; python edge_pipeline.py --camera-id CAM_LKO_HAZRATGANJ_01"
Write-Host "Single image test : cd backend; python edge_pipeline.py --source path\to\car.jpg --no-show"
