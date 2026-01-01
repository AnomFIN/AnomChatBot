#!/bin/bash
#
# AnomChatBot Start Script
# Quick start script for production use
#

echo "🚀 Starting AnomChatBot..."
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found"
    echo "Please run: python3 install.py"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Error: Dependencies not installed"
    echo "Please run: npm install"
    exit 1
fi

# Start the bot
node index.js
