@echo off
setlocal enabledelayedexpansion

echo.
echo  AnomChatBot v2.0
echo  ─────────────────
echo.

REM Check Node.js exists
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

REM Check Node.js version >= 20
for /f "tokens=1 delims=." %%a in ('node -v') do set "NODEVER=%%a"
set "NODEVER=!NODEVER:v=!"
if !NODEVER! LSS 20 (
    echo ERROR: Node.js 20+ required. Found v!NODEVER!
    echo Update from https://nodejs.org/
    pause
    exit /b 1
)

REM Check node_modules exists
if not exist "node_modules" (
    echo ERROR: Dependencies not installed. Run install.bat first.
    pause
    exit /b 1
)

echo Starting AnomChatBot on http://127.0.0.1:3001 ...
echo Press Ctrl+C to stop.
echo.

node src/index.js
if errorlevel 1 (
    echo.
    echo AnomChatBot exited with error.
    pause
)
