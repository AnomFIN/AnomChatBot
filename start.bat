@echo off
setlocal enabledelayedexpansion

title AnomChatBot Launcher

set "APP_NAME=AnomChatBot"
set "APP_VERSION=2.0"
set "BACKEND_URL=http://127.0.0.1:3001"

call :section "AnomChatBot v%APP_VERSION%"
echo  Clean Windows launcher for backend + web UI.
echo.

call :section "Checking dependencies"
where node >nul 2>nul
if errorlevel 1 (
    call :fail "Node.js was not found. Install Node.js 20+ from https://nodejs.org/ and run install.bat."
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set "NODE_VERSION_FULL=%%v"
for /f "tokens=1 delims=." %%a in ("!NODE_VERSION_FULL!") do set "NODEVER=%%a"
set "NODEVER=!NODEVER:v=!"
if !NODEVER! LSS 20 (
    call :fail "Node.js 20+ is required. Found major version !NODEVER!. Update from https://nodejs.org/."
    exit /b 1
)
echo  [OK] Node.js detected: !NODE_VERSION_FULL!

if not exist "node_modules" (
    call :fail "Backend dependencies are missing. Run install.bat first."
    exit /b 1
)
echo  [OK] Backend dependencies installed.

if not exist "web\node_modules" (
    echo  [WARN] Web UI dependencies are missing. install.bat normally installs them.
    echo         If startup fails, run: cd web ^&^& npm install
) else (
    echo  [OK] Web UI dependencies installed.
)

call :section "Starting backend"
echo  Backend process: node src/index.js
echo  Logs: concise application output appears below.
echo.

call :section "Starting web UI"
echo  Production UI is served by the backend when web\dist exists.
echo  For Vite development UI, run in another terminal: cd web ^&^& npm run dev

echo.
call :section "Local URLs"
echo  App / API:  %BACKEND_URL%
echo  Health:     %BACKEND_URL%/api/health
echo  Logs API:   %BACKEND_URL%/api/logs
echo.
echo  Press Ctrl+C to stop.
echo.

node src/index.js
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
    echo.
    call :section "Error instructions"
    echo  %APP_NAME% exited with code %EXIT_CODE%.
    echo  1. Confirm .env values are valid.
    echo  2. Run install.bat if dependencies are missing.
    echo  3. Check the last error lines above.
    echo.
    pause
)
exit /b %EXIT_CODE%

:section
echo.
echo  ============================================================
echo  %~1
echo  ============================================================
exit /b 0

:fail
echo  [ERROR] %~1
echo.
pause
exit /b 0
