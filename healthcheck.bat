@echo off
echo.
echo  AnomChatBot Health Check
echo  ────────────────────────
echo.

REM Try PowerShell first (available on all modern Windows)
where powershell >nul 2>nul
if errorlevel 1 (
    echo ERROR: PowerShell not found. Cannot run health check.
    pause
    exit /b 1
)

echo Checking http://127.0.0.1:3001/api/health ...
echo.

powershell -NoProfile -Command ^
    "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/api/health' -TimeoutSec 5; Write-Host ('Version:   ' + $r.data.version); Write-Host ('Uptime:    ' + $r.data.uptime + 's'); Write-Host ('WhatsApp:  ' + $r.data.whatsapp.status + ' - ' + $r.data.whatsapp.details); Write-Host ('AI:        connected=' + $r.data.ai.connected + ', provider=' + $r.data.ai.provider + ', model=' + $r.data.ai.model); Write-Host ('Database:  initialized=' + $r.data.database.initialized); } catch { Write-Host ('ERROR: Server not reachable. Is AnomChatBot running?'); exit 1; }"

echo.
pause
