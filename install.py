#!/usr/bin/env python3
"""
Professional installer for AnomChatBot
Handles dependencies, configuration, and system setup
"""
import os
import sys
import subprocess
import platform
import shutil
from pathlib import Path
from typing import Tuple


class Colors:
    """ANSI color codes for terminal output"""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


class Installer:
    """AnomChatBot installer"""
    
    def __init__(self):
        self.root_dir = Path(__file__).parent.absolute()
        self.errors = []
        self.warnings = []
    
    def print_header(self, text: str):
        """Print colored header"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{'=' * 60}{Colors.ENDC}\n")
    
    def print_success(self, text: str):
        """Print success message"""
        print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")
    
    def print_error(self, text: str):
        """Print error message"""
        print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")
        self.errors.append(text)
    
    def print_warning(self, text: str):
        """Print warning message"""
        print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")
        self.warnings.append(text)
    
    def print_info(self, text: str):
        """Print info message"""
        print(f"{Colors.OKCYAN}ℹ {text}{Colors.ENDC}")
    
    def run_command(self, cmd: str, shell: bool = True) -> Tuple[int, str, str]:
        """Run shell command and return result"""
        try:
            result = subprocess.run(
                cmd,
                shell=shell,
                capture_output=True,
                text=True,
                timeout=300
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return 1, "", "Command timed out"
        except Exception as e:
            return 1, "", str(e)
    
    def check_python_version(self) -> bool:
        """Check Python version"""
        self.print_info("Checking Python version...")
        
        version = sys.version_info
        if version.major < 3 or (version.major == 3 and version.minor < 8):
            self.print_error(f"Python 3.8+ required, found {version.major}.{version.minor}")
            return False
        
        self.print_success(f"Python {version.major}.{version.minor}.{version.micro}")
        return True
    
    def check_system(self) -> bool:
        """Check system requirements"""
        self.print_info("Checking system...")
        
        system = platform.system()
        if system != "Linux":
            self.print_warning(f"Designed for Linux, running on {system}")
        
        self.print_success(f"System: {system} {platform.release()}")
        return True
    
    def check_pip(self) -> bool:
        """Check if pip is available"""
        self.print_info("Checking pip...")
        
        returncode, stdout, stderr = self.run_command("pip3 --version")
        if returncode != 0:
            self.print_error("pip3 not found")
            return False
        
        self.print_success("pip3 is available")
        return True
    
    def install_dependencies(self) -> bool:
        """Install Python dependencies"""
        self.print_info("Installing Python dependencies...")
        
        requirements_file = self.root_dir / "requirements.txt"
        if not requirements_file.exists():
            self.print_error("requirements.txt not found")
            return False
        
        self.print_info("This may take a few minutes...")
        returncode, stdout, stderr = self.run_command(
            f"pip3 install -r {requirements_file}"
        )
        
        if returncode != 0:
            self.print_error(f"Failed to install dependencies: {stderr}")
            return False
        
        self.print_success("Dependencies installed successfully")
        return True
    
    def create_directories(self) -> bool:
        """Create necessary directories"""
        self.print_info("Creating directories...")
        
        directories = [
            "data/conversations",
            "data/media",
            "data/logs",
            "data/whatsapp_session"
        ]
        
        for directory in directories:
            path = self.root_dir / directory
            path.mkdir(parents=True, exist_ok=True)
        
        self.print_success("Directories created")
        return True
    
    def setup_environment(self) -> bool:
        """Setup environment file"""
        self.print_info("Setting up environment...")
        
        env_example = self.root_dir / ".env.example"
        env_file = self.root_dir / ".env"
        
        if env_file.exists():
            self.print_warning(".env already exists, skipping")
            return True
        
        if not env_example.exists():
            self.print_error(".env.example not found")
            return False
        
        shutil.copy(env_example, env_file)
        self.print_success("Created .env file")
        self.print_warning("IMPORTANT: Edit .env file with your API keys!")
        return True
    
    def setup_gitignore(self) -> bool:
        """Setup .gitignore"""
        self.print_info("Setting up .gitignore...")
        
        gitignore_content = """# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
ENV/
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg

# Environment
.env
.env.local

# Data
data/conversations/
data/media/
data/logs/
data/whatsapp_session/
*.db
*.sqlite

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
"""
        
        gitignore_file = self.root_dir / ".gitignore"
        with open(gitignore_file, 'w') as f:
            f.write(gitignore_content)
        
        self.print_success(".gitignore created")
        return True
    
    def create_systemd_service(self) -> bool:
        """Create systemd service file"""
        self.print_info("Creating systemd service file...")
        
        service_content = f"""[Unit]
Description=AnomChatBot - AI-Powered Multi-Platform Chatbot
After=network.target

[Service]
Type=simple
User={os.getenv('USER', 'root')}
WorkingDirectory={self.root_dir}
ExecStart={sys.executable} {self.root_dir}/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
"""
        
        service_file = self.root_dir / "anomchatbot.service"
        with open(service_file, 'w') as f:
            f.write(service_content)
        
        self.print_success("Service file created: anomchatbot.service")
        self.print_info("To install as systemd service:")
        self.print_info(f"  sudo cp {service_file} /etc/systemd/system/")
        self.print_info("  sudo systemctl daemon-reload")
        self.print_info("  sudo systemctl enable anomchatbot")
        self.print_info("  sudo systemctl start anomchatbot")
        return True
    
    def verify_installation(self) -> bool:
        """Verify installation"""
        self.print_info("Verifying installation...")
        
        # Check if main modules can be imported
        try:
            sys.path.insert(0, str(self.root_dir))
            import src.config
            import src.database
            import src.openai.openai_manager
            self.print_success("All modules can be imported")
        except ImportError as e:
            self.print_error(f"Import error: {e}")
            return False
        
        return True
    
    def print_next_steps(self):
        """Print next steps for user"""
        self.print_header("Next Steps")
        
        print(f"{Colors.BOLD}1. Configure your environment:{Colors.ENDC}")
        print(f"   Edit {Colors.OKCYAN}.env{Colors.ENDC} file and add:")
        print(f"   - {Colors.OKCYAN}OPENAI_API_KEY{Colors.ENDC}")
        print(f"   - {Colors.OKCYAN}TELEGRAM_BOT_TOKEN{Colors.ENDC}")
        print(f"   - {Colors.OKCYAN}TELEGRAM_ADMIN_IDS{Colors.ENDC}")
        
        print(f"\n{Colors.BOLD}2. Run the bot:{Colors.ENDC}")
        print(f"   {Colors.OKCYAN}python3 main.py{Colors.ENDC}")
        
        print(f"\n{Colors.BOLD}3. Use Telegram commands:{Colors.ENDC}")
        print(f"   - {Colors.OKCYAN}/start{Colors.ENDC} - Start the bot")
        print(f"   - {Colors.OKCYAN}/status{Colors.ENDC} - Check status")
        print(f"   - {Colors.OKCYAN}/help{Colors.ENDC} - Show help")
        
        print(f"\n{Colors.BOLD}4. Optional - Install as systemd service:{Colors.ENDC}")
        print(f"   See instructions above for systemd setup")
        
        if self.warnings:
            print(f"\n{Colors.WARNING}{Colors.BOLD}Warnings:{Colors.ENDC}")
            for warning in self.warnings:
                print(f"   ⚠ {warning}")
    
    def run(self) -> bool:
        """Run installation"""
        self.print_header("AnomChatBot Installation")
        
        steps = [
            ("System Check", self.check_system),
            ("Python Version", self.check_python_version),
            ("Pip Check", self.check_pip),
            ("Dependencies", self.install_dependencies),
            ("Directories", self.create_directories),
            ("Environment", self.setup_environment),
            ("Git Ignore", self.setup_gitignore),
            ("Systemd Service", self.create_systemd_service),
            ("Verification", self.verify_installation),
        ]
        
        for step_name, step_func in steps:
            self.print_header(step_name)
            if not step_func():
                self.print_error(f"Failed at step: {step_name}")
                return False
        
        if self.errors:
            self.print_header("Installation Failed")
            print(f"{Colors.FAIL}Errors encountered:{Colors.ENDC}")
            for error in self.errors:
                print(f"  ✗ {error}")
            return False
        
        self.print_header("Installation Complete")
        self.print_success("AnomChatBot installed successfully!")
        
        self.print_next_steps()
        
        return True


def main():
    """Main entry point"""
    installer = Installer()
    
    try:
        success = installer.run()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Installation cancelled by user{Colors.ENDC}")
        sys.exit(1)
    except Exception as e:
        print(f"\n{Colors.FAIL}Installation failed: {e}{Colors.ENDC}")
        sys.exit(1)


if __name__ == "__main__":
    main()
