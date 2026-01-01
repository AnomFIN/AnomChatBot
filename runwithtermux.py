#!/usr/bin/env python3
"""
AnomChatBot - Termux Installer for Android
Bulletproof installer for running the bot on Android phones via Termux

Requirements:
- Termux app from F-Droid (NOT Google Play)
- Storage permission granted
- At least 500MB free space

Usage:
    python runwithtermux.py install   # Install dependencies
    python runwithtermux.py run       # Run the bot
    python runwithtermux.py setup     # Complete setup wizard
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path


class TermuxInstaller:
    """Bulletproof Termux installer for Android"""
    
    def __init__(self):
        self.termux_prefix = os.environ.get('PREFIX', '/data/data/com.termux/files/usr')
        self.is_termux = os.path.exists(self.termux_prefix)
        self.root_dir = Path(__file__).parent.absolute()
        
    def print_header(self, text):
        print("\n" + "="*50)
        print(f"  {text}")
        print("="*50 + "\n")
    
    def print_step(self, text):
        print(f"[*] {text}")
    
    def print_success(self, text):
        print(f"[✓] {text}")
    
    def print_error(self, text):
        print(f"[✗] {text}")
    
    def print_warning(self, text):
        print(f"[!] {text}")
    
    def run_cmd(self, cmd, silent=False):
        """Run shell command"""
        try:
            if silent:
                result = subprocess.run(
                    cmd, shell=True, 
                    stdout=subprocess.DEVNULL, 
                    stderr=subprocess.DEVNULL
                )
            else:
                result = subprocess.run(cmd, shell=True)
            return result.returncode == 0
        except Exception as e:
            if not silent:
                self.print_error(f"Command failed: {e}")
            return False
    
    def check_termux(self):
        """Verify we're running in Termux"""
        self.print_header("Checking Termux Environment")
        
        if not self.is_termux:
            self.print_error("Not running in Termux!")
            self.print_warning("This script is designed for Termux on Android")
            return False
        
        self.print_success("Running in Termux")
        return True
    
    def check_storage_permission(self):
        """Check if storage permission is granted"""
        self.print_step("Checking storage permission...")
        
        storage_path = os.path.expanduser("~/storage")
        if not os.path.exists(storage_path):
            self.print_warning("Storage not set up!")
            print("\nPlease run: termux-setup-storage")
            print("Then grant storage permission and run this script again.\n")
            return False
        
        self.print_success("Storage permission granted")
        return True
    
    def update_packages(self):
        """Update Termux packages"""
        self.print_header("Updating Termux Packages")
        
        self.print_step("Updating package lists...")
        if not self.run_cmd("pkg update -y"):
            self.print_error("Package update failed")
            return False
        
        self.print_success("Packages updated")
        return True
    
    def install_system_deps(self):
        """Install system dependencies"""
        self.print_header("Installing System Dependencies")
        
        packages = [
            'python',
            'python-pip',
            'git',
            'wget',
            'ffmpeg',        # For audio processing
            'libjpeg-turbo', # For image processing
            'libpng',        # For image processing
            'openssl',       # For SSL connections
            'rust',          # For some Python packages
        ]
        
        for pkg in packages:
            self.print_step(f"Installing {pkg}...")
            if not self.run_cmd(f"pkg install {pkg} -y", silent=True):
                self.print_warning(f"Failed to install {pkg} (might already be installed)")
        
        self.print_success("System dependencies installed")
        return True
    
    def create_directories(self):
        """Create necessary directories"""
        self.print_header("Creating Directories")
        
        dirs = [
            "data/conversations",
            "data/media/image",
            "data/media/audio",
            "data/media/video",
            "data/media/document",
            "data/logs",
            "data/whatsapp_session"
        ]
        
        for dir_path in dirs:
            full_path = self.root_dir / dir_path
            full_path.mkdir(parents=True, exist_ok=True)
        
        self.print_success("Directories created")
        return True
    
    def install_python_deps(self):
        """Install Python dependencies"""
        self.print_header("Installing Python Dependencies")
        
        self.print_step("Upgrading pip...")
        self.run_cmd("pip install --upgrade pip", silent=True)
        
        self.print_step("Installing dependencies (this may take 10-15 minutes)...")
        self.print_warning("Be patient! Building packages on Android takes time.")
        
        # Install in stages for better success rate
        basic_deps = [
            "python-dotenv",
            "pyyaml",
            "loguru",
            "aiofiles",
            "aiohttp",
            "requests",
        ]
        
        ai_deps = [
            "openai",
            "tiktoken",
        ]
        
        telegram_deps = [
            "python-telegram-bot",
        ]
        
        db_deps = [
            "sqlalchemy",
            "aiosqlite",
        ]
        
        media_deps = [
            "pillow",
            "qrcode",
            "pydub",
        ]
        
        all_dep_groups = [
            ("Basic", basic_deps),
            ("AI", ai_deps),
            ("Telegram", telegram_deps),
            ("Database", db_deps),
            ("Media", media_deps),
        ]
        
        for group_name, deps in all_dep_groups:
            self.print_step(f"Installing {group_name} dependencies...")
            deps_str = " ".join(deps)
            if not self.run_cmd(f"pip install {deps_str}"):
                self.print_warning(f"Some {group_name} dependencies failed")
        
        self.print_success("Python dependencies installed")
        return True
    
    def create_env_file(self):
        """Create .env file with Android-specific paths"""
        self.print_header("Creating Configuration")
        
        env_file = self.root_dir / ".env"
        env_example = self.root_dir / ".env.example"
        
        if env_file.exists():
            self.print_warning(".env already exists, skipping")
            return True
        
        if not env_example.exists():
            self.print_error(".env.example not found")
            return False
        
        # Copy and modify for Termux
        shutil.copy(env_example, env_file)
        
        self.print_success("Configuration file created")
        self.print_warning("⚠️  IMPORTANT: Edit .env file with your API keys!")
        print("\nRequired keys:")
        print("  - OPENAI_API_KEY")
        print("  - TELEGRAM_BOT_TOKEN")
        print("  - TELEGRAM_ADMIN_IDS")
        print("\nEdit with: nano .env\n")
        
        return True
    
    def show_setup_wizard(self):
        """Interactive setup wizard"""
        self.print_header("Setup Wizard")
        
        print("Let's configure your bot!\n")
        
        # OpenAI API Key
        print("1. OpenAI API Key")
        print("   Get it from: https://platform.openai.com/api-keys")
        openai_key = input("   Enter your OpenAI API key: ").strip()
        
        # Telegram Bot Token
        print("\n2. Telegram Bot Token")
        print("   Get it from: @BotFather on Telegram")
        telegram_token = input("   Enter your Telegram bot token: ").strip()
        
        # Telegram Admin ID
        print("\n3. Telegram Admin ID")
        print("   Get it from: @userinfobot on Telegram")
        admin_id = input("   Enter your Telegram user ID: ").strip()
        
        # Write to .env
        env_content = f"""# OpenAI Configuration
OPENAI_API_KEY={openai_key}
OPENAI_MODEL=gpt-4-turbo-preview

# Telegram Configuration
TELEGRAM_BOT_TOKEN={telegram_token}
TELEGRAM_ADMIN_IDS={admin_id}

# WhatsApp Configuration (Termux)
WHATSAPP_SESSION_PATH=./data/whatsapp_session

# Database Configuration (Termux)
DATABASE_URL=sqlite+aiosqlite:///./data/conversations.db

# Application Configuration
LOG_LEVEL=INFO
MAX_CONVERSATION_HISTORY=50
AUTO_SAVE_INTERVAL=60

# Media Configuration (Termux optimized)
MAX_IMAGE_SIZE=2097152
MAX_VIDEO_SIZE=10485760
MAX_AUDIO_SIZE=5242880
SUPPORTED_IMAGE_FORMATS=jpg,jpeg,png
SUPPORTED_VIDEO_FORMATS=mp4
SUPPORTED_AUDIO_FORMATS=mp3,ogg,m4a

# AI Configuration
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=1000
DEFAULT_SYSTEM_PROMPT=Olet avulias ja ystävällinen assistentti joka vastaa suomeksi.
"""
        
        env_file = self.root_dir / ".env"
        with open(env_file, 'w') as f:
            f.write(env_content)
        
        self.print_success("Configuration saved!")
        return True
    
    def create_run_script(self):
        """Create convenient run script"""
        self.print_header("Creating Run Script")
        
        run_script = self.root_dir / "run.sh"
        script_content = """#!/bin/bash
# AnomChatBot - Termux Run Script

echo "🤖 Starting AnomChatBot..."
echo ""

# Check if configured
if [ ! -f .env ]; then
    echo "❌ Not configured! Run: python runwithtermux.py setup"
    exit 1
fi

# Run bot
python main.py
"""
        
        with open(run_script, 'w') as f:
            f.write(script_content)
        
        os.chmod(run_script, 0o755)
        
        self.print_success("Run script created")
        return True
    
    def show_termux_tips(self):
        """Show Termux-specific tips"""
        self.print_header("Termux Tips")
        
        print("""
📱 Running on Android with Termux:

1. Keep Termux running:
   - Swipe down notification panel
   - Tap 'Acquire wakelock' to prevent sleep
   
2. Background execution:
   - Use: nohup python main.py &
   - Or: tmux (install with: pkg install tmux)
   
3. Monitor logs:
   - tail -f data/logs/anomchatbot.log
   
4. Stop bot:
   - Press Ctrl+C
   - Or: pkill -f main.py
   
5. Limitations on Android:
   - WhatsApp Web may be slower
   - Limited media processing
   - Battery drain (keep phone charged)
   - May need to disable battery optimization
   
6. Troubleshooting:
   - If bot crashes: check data/logs/
   - If WhatsApp fails: delete data/whatsapp_session/
   - If memory issues: reduce MAX_CONVERSATION_HISTORY
   
7. Updates:
   - git pull
   - python runwithtermux.py install
""")
    
    def install(self):
        """Full installation process"""
        self.print_header("AnomChatBot - Termux Installation")
        
        if not self.check_termux():
            return False
        
        if not self.check_storage_permission():
            return False
        
        steps = [
            self.update_packages,
            self.install_system_deps,
            self.create_directories,
            self.install_python_deps,
            self.create_env_file,
            self.create_run_script,
        ]
        
        for step in steps:
            if not step():
                self.print_error("Installation failed!")
                return False
        
        self.print_header("Installation Complete!")
        self.print_success("AnomChatBot installed successfully!")
        
        print("\n📋 Next steps:")
        print("1. Configure: python runwithtermux.py setup")
        print("2. Run bot:   python main.py")
        print("3. Or use:    ./run.sh\n")
        
        self.show_termux_tips()
        
        return True
    
    def run(self):
        """Run the bot"""
        env_file = self.root_dir / ".env"
        if not env_file.exists():
            self.print_error("Not configured!")
            print("Run: python runwithtermux.py setup")
            return False
        
        self.print_header("Starting AnomChatBot")
        self.run_cmd("python main.py")
        return True
    
    def setup(self):
        """Setup wizard"""
        return self.show_setup_wizard()


def main():
    """Main entry point"""
    installer = TermuxInstaller()
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python runwithtermux.py install   # Install dependencies")
        print("  python runwithtermux.py setup     # Setup wizard")
        print("  python runwithtermux.py run       # Run bot")
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "install":
        success = installer.install()
    elif command == "setup":
        success = installer.setup()
    elif command == "run":
        success = installer.run()
    else:
        print(f"Unknown command: {command}")
        success = False
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
