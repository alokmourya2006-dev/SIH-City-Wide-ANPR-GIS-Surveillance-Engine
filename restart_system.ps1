# ARGUS full restart - run this ONE file, nothing else needed.
# Usage: powershell -ExecutionPolicy Bypass -File restart_system.ps1
$ROOT = "c:\Users\Alok maurya\OneDrive\Desktop\SIH 127"
$BACKEND = Join-Path $ROOT "backend\app"
$FRONTEND = Join-Path $ROOT "frontend"
Write-Host "=== ARGUS RESTART ===" -ForegroundColor Cyan
foreach ($port in 8000, 5173) {
  try {
    $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      $p = Get-Process -Id $c.OwningProcess -ErrorAction SilentlyContinue
      if ($p) { Write-Host "Killing $($p.ProcessName) PID $($p.Id) on :$port"; Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    }
  } catch {}
}
try {
  Get-CimInstance Win32_Process -Filter "Name='python.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'edge_pipeline|uvicorn' } |
    ForEach-Object { Write-Host "Killing old edge/uvicorn PID $($_.ProcessId)"; Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
} catch {}
Start-Sleep 2
Write-Host "Compiling..." -ForegroundColor Yellow
python -m py_compile (Join-Path $BACKEND "main.py"), (Join-Path $BACKEND "plate_detector.py"), (Join-Path $BACKEND "plate_localizer.py"), (Join-Path $BACKEND "tracker.py"), (Join-Path $ROOT "backend\edge_pipeline.py")
if ($LASTEXITCODE -ne 0) { Write-Host "COMPILE FAILED - fix errors first" -ForegroundColor Red; exit 1 }
Write-Host "Compile OK" -ForegroundColor Green
$backendCmd = "python -m uvicorn main:app --host 127.0.0.1 --port 8000"
Write-Host "Starting backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command", $backendCmd -WorkingDirectory $BACKEND
$frontendCmd = "npm run dev -- --host --port 5173"
Write-Host "Starting frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit","-Command", $frontendCmd -WorkingDirectory $FRONTEND
Write-Host "Waiting 12s..." -ForegroundColor Yellow
Start-Sleep 12
try { $b = Invoke-WebRequest "http://127.0.0.1:8000/docs" -TimeoutSec 5 -UseBasicParsing; Write-Host "Backend UP ($($b.StatusCode))" -ForegroundColor Green } catch { Write-Host "Backend NOT UP YET: $_" -ForegroundColor Red }
try { $f = Invoke-WebRequest "http://localhost:5173/" -TimeoutSec 5 -UseBasicParsing; Write-Host "Frontend UP ($($f.StatusCode))" -ForegroundColor Green } catch { Write-Host "Frontend NOT UP YET: $_" -ForegroundColor Red }
Write-Host ""
Write-Host "Dashboard: http://localhost:5173/ | API: http://127.0.0.1:8000/docs | Login: POLICE_7082 / admin123" -ForegroundColor Cyan
Write-Host "Edge live: cd backend; python edge_pipeline.py --camera-id CAM_LKO_HAZRATGANJ_01" -ForegroundColor Cyan
