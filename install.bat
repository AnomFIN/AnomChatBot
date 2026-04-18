@echo off
setlocal enabledelayedexpansion

echo.
echo ================================================================
echo              AnomChatBot v2.0 — Installer
echo ================================================================
echo.

REM ── Check Node.js ─────────────────────────────────────────────
where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=1 delims=." %%a in ('node -v') do set "NODEVER=%%a"
set "NODEVER=!NODEVER:v=!"
if !NODEVER! LSS 20 (
    echo ERROR: Node.js 20+ required. Found v!NODEVER!
    echo Update from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js %%v

REM ── Check npm ─────────────────────────────────────────────────
where npm >nul 2>nul
if errorlevel 1 (
    echo ERROR: npm not found. Reinstall Node.js from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm -v') do echo [OK] npm %%v

REM ── Install backend dependencies ──────────────────────────────
echo.
echo Installing backend dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed for backend.
    pause
    exit /b 1
)
echo [OK] Backend dependencies installed.

REM ── Install and build React frontend ──────────────────────────
echo.
echo Installing frontend dependencies...
pushd web
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed for frontend.
    popd
    pause
    exit /b 1
)
echo [OK] Frontend dependencies installed.

echo Building React frontend...
call npm run build
if errorlevel 1 (
    echo ERROR: React build failed.
    popd
    pause
    exit /b 1
)
popd

if not exist "web\dist\index.html" (
    echo ERROR: Frontend build did not produce web\dist\index.html
    pause
    exit /b 1
)
echo [OK] Frontend built to web\dist\

REM ── Create .env from template ─────────────────────────────────
echo.
if not exist ".env" (
    copy .env.example .env >nul
    echo [OK] Created .env from template — edit it with your API keys.
) else (
    echo [OK] .env already exists, skipping.
)

REM ── Create data directory ─────────────────────────────────────
if not exist "data" mkdir data
echo [OK] data\ directory ready.

echo.
echo ================================================================
echo  Installation complete!
echo.
echo  Next steps:
echo    1. Edit .env with your API keys
echo    2. Run start.bat to launch AnomChatBot
echo    3. Open http://127.0.0.1:3001 in your browser
echo ================================================================
echo.
pause
