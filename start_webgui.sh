#!/bin/bash
# Web GUI Startup Script for AnomChatBot

echo "=========================================="
echo "  AnomChatBot Web GUI Launcher"
echo "=========================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from template..."
    cp .env.example .env
    echo "✓ Created .env file. Please edit it with your API keys."
    echo ""
    echo "Required configuration:"
    echo "  - OPENAI_API_KEY: Your OpenAI API key"
    echo "  - TELEGRAM_BOT_TOKEN: (optional if Web GUI only)"
    echo "  - TELEGRAM_ADMIN_IDS: (optional if Web GUI only)"
    echo ""
    echo "Web GUI settings:"
    echo "  - WEB_GUI_ENABLED=true"
    echo "  - TELEGRAM_ENABLED=false (to disable Telegram requirement)"
    echo ""
    read -p "Press Enter after editing .env file..."
fi

# Check if Python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

echo "✓ Python3 found: $(python3 --version)"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate || . venv/bin/activate

# Install/update dependencies
echo "Installing dependencies..."
pip install -q --upgrade pip
pip install -q -r requirements.txt

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

# Check .env settings
if grep -q "WEB_GUI_ENABLED=true" .env; then
    echo "✓ Web GUI is enabled"
    WEB_PORT=$(grep "WEB_GUI_PORT" .env | cut -d '=' -f2 || echo "3001")
    echo "✓ Web GUI will be available at: http://localhost:${WEB_PORT}/"
else
    echo "⚠️  WEB_GUI_ENABLED is not set to true in .env"
    echo "   The Web GUI may not be available."
fi

if grep -q "TELEGRAM_ENABLED=false" .env; then
    echo "✓ Telegram is disabled (Web GUI only mode)"
elif grep -q "TELEGRAM_ENABLED=true" .env; then
    echo "✓ Telegram is enabled (Dual mode: Web GUI + Telegram)"
else
    echo "⚠️  TELEGRAM_ENABLED not set, defaulting to enabled"
fi

echo ""
echo "=========================================="
echo "  Starting AnomChatBot..."
echo "=========================================="
echo ""

# Start the bot
python3 main.py

# Deactivate virtual environment on exit
deactivate
