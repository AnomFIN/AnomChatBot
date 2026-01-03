@echo off
setlocal enabledelayedexpansion

REM AnomChatBot Windows Installation Script
REM Production-grade installer for Windows environments

echo.
echo ================================================================
echo              AnomChatBot Installation Script
echo.
echo      Production-Ready WhatsApp - Telegram - AI Bridge
echo.
echo ================================================================
echo.

REM Color definitions
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "BLUE=[94m"
set "RESET=[0m"

REM Variables
set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "ENV_FILE=%PROJECT_DIR%\.env"
set "REQUIREMENTS_FILE=%PROJECT_DIR%\requirements.txt"
set "ROLLBACK_FILES="
set "INSTALL_SUCCESS=0"

REM Function to print colored messages
:print_success
echo %GREEN%✓ %~1%RESET%
exit /b 0

:print_error  
echo %RED%✗ %~1%RESET%
exit /b 0

:print_warning
echo %YELLOW%⚠ %~1%RESET%
exit /b 0

:print_info
echo %BLUE%ℹ %~1%RESET%
exit /b 0

:print_header
echo.
echo %BLUE%================================================================%RESET%
echo %BLUE%                    %~1                    %RESET%
echo %BLUE%================================================================%RESET%
echo.
exit /b 0

REM Check if Python is installed
:check_python
call :print_header "CHECKING SYSTEM REQUIREMENTS"
call :print_info "Checking Python installation..."

python --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=2" %%v in ('python --version 2^>^&1') do (
        call :print_success "Python found: %%v"
        set "PYTHON_CMD=python"
        goto check_pip
    )
)

python3 --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=2" %%v in ('python3 --version 2^>^&1') do (
        call :print_success "Python3 found: %%v"
        set "PYTHON_CMD=python3"
        goto check_pip
    )
)

py --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f "tokens=2" %%v in ('py --version 2^>^&1') do (
        call :print_success "Python launcher found: %%v"
        set "PYTHON_CMD=py"
        goto check_pip
    )
)

call :print_error "Python 3.8+ is required but not found!"
call :print_info "Download from: https://www.python.org/downloads/"
call :print_info "Make sure to check 'Add Python to PATH' during installation"
goto error_exit

:check_pip
call :print_info "Checking pip installation..."
%PYTHON_CMD% -m pip --version >nul 2>&1
if !errorlevel! neq 0 (
    call :print_error "pip is not available!"
    call :print_info "Try: %PYTHON_CMD% -m ensurepip --upgrade"
    goto error_exit
)

for /f "tokens=2" %%v in ('%PYTHON_CMD% -m pip --version 2^>^&1') do (
    call :print_success "pip found: %%v"
)

REM Check Node.js (optional)
call :print_info "Checking Node.js installation (optional)..."
node --version >nul 2>&1
if !errorlevel! equ 0 (
    for /f %%v in ('node --version 2^>^&1') do (
        call :print_success "Node.js found: %%v"
        set "NODE_AVAILABLE=1"
    )
) else (
    call :print_warning "Node.js not found (optional for full features)"
    call :print_info "Download from: https://nodejs.org/"
    set "NODE_AVAILABLE=0"
)

REM Check Chrome (optional)
call :print_info "Checking for Chrome browser..."
set "CHROME_FOUND=0"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    call :print_success "Google Chrome found"
    set "CHROME_FOUND=1"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    call :print_success "Google Chrome found"
    set "CHROME_FOUND=1"
) else (
    call :print_warning "Chrome not found - WhatsApp Web may not work"
    call :print_info "Download from: https://www.google.com/chrome/"
)

goto create_directories

:create_directories
call :print_header "CREATING DIRECTORIES"
call :print_info "Creating necessary directories..."

set "DIRS=data\conversations data\media\images data\media\audio data\media\video data\media\documents data\logs data\whatsapp_session data\qr_codes logs"

for %%d in (%DIRS%) do (
    if not exist "%PROJECT_DIR%\%%d" (
        mkdir "%PROJECT_DIR%\%%d" >nul 2>&1
        if !errorlevel! equ 0 (
            echo Created: %%d
            set "ROLLBACK_FILES=!ROLLBACK_FILES! %%d"
        ) else (
            call :print_error "Failed to create directory: %%d"
            goto rollback_and_exit
        )
    )
)

call :print_success "Directories created successfully"
goto collect_config

:collect_config
call :print_header "CONFIGURATION"
echo Please provide the following configuration values:
echo %YELLOW%(These will be saved in .env file)%RESET%
echo.

REM OpenAI API Key
:get_openai_key
set /p "OPENAI_API_KEY=OpenAI API Key: "
if "!OPENAI_API_KEY!"=="" (
    call :print_warning "API key is required"
    goto get_openai_key
)
echo !OPENAI_API_KEY! | findstr /r "^sk-" >nul
if !errorlevel! neq 0 (
    echo !OPENAI_API_KEY! | findstr /r "^org-" >nul
    if !errorlevel! neq 0 (
        call :print_warning "Invalid API key format. Should start with 'sk-' or 'org-'"
        call :print_info "Get your API key from: https://platform.openai.com/api-keys"
        goto get_openai_key
    )
)

REM OpenAI Model
echo.
echo Available OpenAI models:
echo   1. gpt-4-turbo-preview (recommended)
echo   2. gpt-4
echo   3. gpt-3.5-turbo
echo   4. gpt-4o

:get_model_choice
set /p "MODEL_CHOICE=Select model (1-4) [1]: "
if "!MODEL_CHOICE!"=="" set "MODEL_CHOICE=1"

if "!MODEL_CHOICE!"=="1" set "OPENAI_MODEL=gpt-4-turbo-preview"
if "!MODEL_CHOICE!"=="2" set "OPENAI_MODEL=gpt-4"
if "!MODEL_CHOICE!"=="3" set "OPENAI_MODEL=gpt-3.5-turbo"
if "!MODEL_CHOICE!"=="4" set "OPENAI_MODEL=gpt-4o"

if "!OPENAI_MODEL!"=="" (
    call :print_warning "Please enter a number between 1 and 4"
    goto get_model_choice
)

REM Telegram Bot Token
echo.
:get_telegram_token
set /p "TELEGRAM_BOT_TOKEN=Telegram Bot Token: "
if "!TELEGRAM_BOT_TOKEN!"=="" (
    call :print_warning "Bot token is required"
    goto get_telegram_token
)
echo !TELEGRAM_BOT_TOKEN! | findstr ":" >nul
if !errorlevel! neq 0 (
    call :print_warning "Invalid bot token format (should contain :)"
    call :print_info "Get your bot token from: https://t.me/BotFather"
    goto get_telegram_token
)

REM Telegram Admin IDs
echo.
echo %YELLOW%Get your user ID from: https://t.me/userinfobot%RESET%
:get_admin_ids
set /p "TELEGRAM_ADMIN_IDS=Telegram Admin IDs (comma-separated): "
if "!TELEGRAM_ADMIN_IDS!"=="" (
    call :print_warning "At least one admin ID is required"
    goto get_admin_ids
)

call :print_success "Configuration collected successfully"
goto create_env

:create_env
call :print_header "CREATING ENVIRONMENT FILE"

if exist "%ENV_FILE%" (
    call :print_warning ".env file already exists"
    set /p "OVERWRITE=Overwrite? (y/n): "
    if /i not "!OVERWRITE!"=="y" if /i not "!OVERWRITE!"=="yes" (
        call :print_info "Keeping existing .env file"
        goto install_dependencies
    )
    
    REM Backup existing
    copy "%ENV_FILE%" "%ENV_FILE%.backup" >nul 2>&1
    if !errorlevel! equ 0 (
        call :print_info "Backed up existing .env to .env.backup"
    )
)

REM Create .env file
(
echo # AnomChatBot Configuration
echo # Generated by install.bat on %DATE% at %TIME%
echo.
echo # OpenAI Configuration
echo OPENAI_API_KEY=!OPENAI_API_KEY!
echo OPENAI_MODEL=!OPENAI_MODEL!
echo DEFAULT_TEMPERATURE=0.7
echo DEFAULT_MAX_TOKENS=2000
echo.
echo # Telegram Configuration
echo TELEGRAM_BOT_TOKEN=!TELEGRAM_BOT_TOKEN!
echo TELEGRAM_ADMIN_IDS=!TELEGRAM_ADMIN_IDS!
echo.
echo # WhatsApp Configuration
echo WHATSAPP_SESSION_PATH=./data/whatsapp_session
echo.
echo # Database Configuration
echo DATABASE_URL=sqlite+aiosqlite:///./data/conversations.db
echo.
echo # Application Settings
echo LOG_LEVEL=INFO
echo MAX_CONVERSATION_HISTORY=50
echo AUTO_SAVE_INTERVAL=60
echo.
echo # Security
echo SECURE_SESSION=true
echo RATE_LIMIT_ENABLED=true
) > "%ENV_FILE%"

if !errorlevel! equ 0 (
    call :print_success ".env file created successfully"
    set "ROLLBACK_FILES=!ROLLBACK_FILES! .env"
) else (
    call :print_error "Failed to create .env file"
    goto rollback_and_exit
)

goto install_dependencies

:install_dependencies
call :print_header "INSTALLING DEPENDENCIES"
call :print_info "Installing Python dependencies..."
call :print_warning "This may take several minutes..."

REM Upgrade pip first
call :print_info "Upgrading pip..."
%PYTHON_CMD% -m pip install --upgrade pip >nul 2>&1

REM Check if requirements.txt exists
if not exist "%REQUIREMENTS_FILE%" (
    call :print_error "requirements.txt not found!"
    goto rollback_and_exit
)

REM Install Python requirements
call :print_info "Installing Python packages from requirements.txt..."
%PYTHON_CMD% -m pip install -r "%REQUIREMENTS_FILE%"
if !errorlevel! neq 0 (
    call :print_error "Failed to install Python dependencies"
    call :print_info "Try running manually:"
    call :print_info "  %PYTHON_CMD% -m pip install -r requirements.txt"
    goto rollback_and_exit
)

call :print_success "Python dependencies installed successfully"

REM Install Node.js dependencies if available
if !NODE_AVAILABLE!==1 (
    if exist "%PROJECT_DIR%\package.json" (
        call :print_info "Installing Node.js dependencies..."
        cd /d "%PROJECT_DIR%"
        npm install >nul 2>&1
        if !errorlevel! equ 0 (
            call :print_success "Node.js dependencies installed"
        ) else (
            call :print_warning "Failed to install Node.js dependencies (non-fatal)"
        )
    )
)

goto verify_installation

:verify_installation
call :print_header "VERIFYING INSTALLATION"

REM Check main files
call :print_info "Checking required files..."

set "REQUIRED_FILES=main.py src\config.py requirements.txt"
for %%f in (%REQUIRED_FILES%) do (
    if exist "%PROJECT_DIR%\%%f" (
        call :print_success "✓ %%f"
    ) else (
        call :print_error "✗ Required file not found: %%f"
        goto rollback_and_exit
    )
)

REM Test Python imports
call :print_info "Testing Python dependencies..."
%PYTHON_CMD% -c "import openai, telegram, sqlalchemy, loguru, yaml, dotenv, selenium, aiofiles; print('All imports successful')" >nul 2>&1
if !errorlevel! equ 0 (
    call :print_success "✓ Python dependencies verified"
) else (
    call :print_error "✗ Python dependency verification failed"
    goto rollback_and_exit
)

REM Test configuration
call :print_info "Testing configuration..."
cd /d "%PROJECT_DIR%"
%PYTHON_CMD% -c "import sys; sys.path.insert(0, 'src'); from config import get_config; config = get_config(); assert config.validate(), 'Config validation failed'; print('Configuration valid')" >nul 2>&1
if !errorlevel! equ 0 (
    call :print_success "✓ Configuration validation"
) else (
    call :print_error "✗ Configuration validation failed"
    goto rollback_and_exit
)

call :print_success "Installation verified successfully!"
set "INSTALL_SUCCESS=1"
goto print_next_steps

:print_next_steps
call :print_header "INSTALLATION COMPLETE"
echo %GREEN%%GREEN%🎉 AnomChatBot is ready to use!%RESET%
echo.
echo %BLUE%Next steps:%RESET%
echo   1. Start the chatbot:
echo      %GREEN%python main.py%RESET%
echo.
echo   2. First-time setup:
echo      • QR code will be saved to: data\qr_codes\qr_code.png
echo      • Scan with WhatsApp mobile app
echo      • Check Telegram bot for connection status
echo.
echo   3. Usage:
echo      • First message must ALWAYS be sent manually
echo      • Use Telegram commands to control conversations
echo      • Use /help in Telegram for all commands
echo.
echo %BLUE%Important files:%RESET%
echo   Configuration: %GREEN%%ENV_FILE%%RESET%
echo   Logs: %GREEN%%PROJECT_DIR%\data\logs\%RESET%
echo   Database: %GREEN%%PROJECT_DIR%\data\conversations.db%RESET%
echo.

goto ask_start_now

:ask_start_now
echo %BLUE%Do you want to start the chatbot now?%RESET%
echo %YELLOW%Note: First run will require QR code scanning%RESET%
set /p "START_NOW=Start chatbot? (y/n): "

if /i "!START_NOW!"=="y" (
    echo.
    call :print_info "Starting AnomChatBot..."
    call :print_warning "Press Ctrl+C to stop"
    echo.
    cd /d "%PROJECT_DIR%"
    %PYTHON_CMD% main.py
) else if /i "!START_NOW!"=="yes" (
    echo.
    call :print_info "Starting AnomChatBot..."
    call :print_warning "Press Ctrl+C to stop"
    echo.
    cd /d "%PROJECT_DIR%"
    %PYTHON_CMD% main.py
) else (
    call :print_info "You can start the chatbot later with:"
    call :print_info "  cd /d %PROJECT_DIR%"
    call :print_info "  python main.py"
)

goto success_exit

:rollback_and_exit
call :print_warning "Rolling back changes..."
for %%f in (!ROLLBACK_FILES!) do (
    if exist "%PROJECT_DIR%\%%f" (
        if exist "%PROJECT_DIR%\%%f\*" (
            rmdir /s /q "%PROJECT_DIR%\%%f" >nul 2>&1
        ) else (
            del /q "%PROJECT_DIR%\%%f" >nul 2>&1
        )
        call :print_info "Removed: %%f"
    )
)
goto error_exit

:error_exit
echo.
call :print_error "Installation failed!"
call :print_error "Please check the errors above and try again."
echo.
pause
exit /b 1

:success_exit
echo.
call :print_success "SUCCESS: AnomChatBot installation completed!"
echo.
pause
exit /b 0