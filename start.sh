#!/bin/bash
# AnomChatBot Startup Script
# Production-grade startup script with error handling

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_CMD="python3"
LOG_FILE="$PROJECT_DIR/data/logs/startup.log"
PID_FILE="$PROJECT_DIR/data/anomchatbot.pid"

# Functions
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

# Check if Python 3 is available
check_python() {
    if ! command -v $PYTHON_CMD &> /dev/null; then
        if command -v python &> /dev/null; then
            PYTHON_CMD="python"
        else
            print_error "Python 3 not found. Please install Python 3.8 or higher."
            exit 1
        fi
    fi
    
    print_status "Using Python"
}

# Check configuration
check_config() {
    print_status "Checking configuration..."
    
    if [[ ! -f "$PROJECT_DIR/.env" ]]; then
        print_warning ".env file not found. Please run install.py first."
        exit 1
    fi
    
    print_status "Configuration OK"
}

# Ensure required directories exist
ensure_directories() {
    local dirs=(
        "$PROJECT_DIR/data/logs"
        "$PROJECT_DIR/data/conversations"
        "$PROJECT_DIR/data/media/images"
        "$PROJECT_DIR/data/whatsapp_session"
        "$PROJECT_DIR/logs"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
        fi
    done
}

# Main execution
main() {
    print_header "🚀 Starting AnomChatBot"
    
    # Pre-flight checks
    check_python
    check_config
    ensure_directories
    
    # Change to project directory
    cd "$PROJECT_DIR"
    
    # Start the application
    print_status "Starting AnomChatBot..."
    print_status "Press Ctrl+C to stop"
    
    $PYTHON_CMD main.py
}

# Run main function
main "$@"
