#!/usr/bin/env python3
"""
AnomChatBot Installation Script
Production-grade installer for Linux environments
"""

import os
import sys
import subprocess
import shutil
import shlex
from pathlib import Path

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

class AnomChatBotInstaller:
    def __init__(self):
        self.project_dir = Path(__file__).parent.absolute()
        self.env_file = self.project_dir / '.env'
        self.use_venv = False
        self.config = {}
        
    def print_header(self, text):
        """Print formatted header"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")
    
    def print_success(self, text):
        """Print success message"""
        print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")
    
    def print_error(self, text):
        """Print error message"""
        print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")
    
    def print_warning(self, text):
        """Print warning message"""
        print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")
    
    def print_info(self, text):
        """Print info message"""
        print(f"{Colors.OKCYAN}ℹ {text}{Colors.ENDC}")
    
    def run_command(self, cmd, check=True, capture=True):
        """Run shell command with error handling
        
        Args:
            cmd: Command as string or list of arguments
            check: Whether to check return code
            capture: Whether to capture output
            
        Note: When cmd is a string, it will be split into a list to avoid shell=True
        """
        try:
            # Convert string to list for safer execution without shell=True
            if isinstance(cmd, str):
                # Use shlex.split for proper shell-like splitting
                cmd_list = shlex.split(cmd)
            elif isinstance(cmd, list):
                cmd_list = cmd
            else:
                raise TypeError(f"cmd must be string or list, not {type(cmd).__name__}")
            
            if capture:
                result = subprocess.run(
                    cmd_list,
                    shell=False,
                    check=check,
                    capture_output=True,
                    text=True
                )
                return result.returncode == 0, result.stdout, result.stderr
            else:
                result = subprocess.run(cmd_list, shell=False, check=check)
                return result.returncode == 0, "", ""
        except TypeError as e:
            # Handle invalid command type
            return False, "", str(e)
        except FileNotFoundError as e:
            # Handle command not found
            return False, "", str(e)
        except subprocess.CalledProcessError as e:
            return False, "", str(e)
    
    def check_system_requirements(self):
        """Check if system meets requirements"""
        self.print_header("CHECKING SYSTEM REQUIREMENTS")
        
        # Check OS
        if sys.platform not in ['linux', 'linux2']:
            self.print_warning("This installer is designed for Linux. Other OS may have issues.")
        
        # Check Node.js
        self.print_info("Checking Node.js installation...")
        success, stdout, stderr = self.run_command("node --version")
        
        if not success:
            self.print_error("Node.js is not installed!")
            self.print_info("Please install Node.js 18+ from: https://nodejs.org/")
            self.print_info("Or use: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -")
            self.print_info("          sudo apt-get install -y nodejs")
            return False
        
        version = stdout.strip()
        self.print_success(f"Node.js found: {version}")
        
        # Check npm
        self.print_info("Checking npm installation...")
        success, stdout, stderr = self.run_command("npm --version")
        
        if not success:
            self.print_error("npm is not installed!")
            return False
        
        self.print_success("pip3 is available")
        return True
    
    def check_chrome_chromium(self) -> bool:
        """Check if Chrome/Chromium is available (for WhatsApp Web)"""
        self.print_info("Checking for Chrome/Chromium...")
        
        browsers = ['chromium', 'chromium-browser', 'google-chrome', 'chrome']
        for browser in browsers:
            returncode, _, _ = self.run_command(f"which {browser}")
            if returncode == 0:
                self.print_success(f"Found: {browser}")
                return True
        
        self.print_warning("Chrome/Chromium not found. WhatsApp Web may not work.")
        self.print_info("Install with: sudo apt install chromium-browser")
        return True  # Not fatal, return True to continue
    
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
        version = stdout.strip()
        self.print_success(f"npm found: {version}")
        
        # Check for Chrome/Chromium (required for WhatsApp Web)
        self.print_info("Checking for Chrome/Chromium...")
        chrome_found = False
        
        for chrome_cmd in ['google-chrome', 'chromium-browser', 'chromium']:
            success, _, _ = self.run_command(f"which {chrome_cmd}")
            if success:
                chrome_found = True
                self.print_success(f"Browser found: {chrome_cmd}")
                break
        
        if not chrome_found:
            self.print_warning("Chrome/Chromium not found. Installing dependencies...")
            self.print_info("Installing Chromium dependencies...")
            
            # Install Chromium dependencies
            commands = [
                "sudo apt-get update",
                "sudo apt-get install -y chromium-browser chromium-chromedriver"
            ]
            
            for cmd in commands:
                self.print_info(f"Running: {cmd}")
                success, _, stderr = self.run_command(cmd, check=False, capture=False)
                
                if not success:
                    self.print_warning("Could not install Chromium automatically")
                    self.print_info("Please install manually: sudo apt-get install chromium-browser")
        
        return True
    
    def create_directories(self) -> bool:
        """Create necessary directories"""
        self.print_info("Creating directories...")
        
        directories = [
            "data/conversations",
            "data/media/image",
            "data/media/audio",
            "data/media/video",
            "data/media/document",
            "data/logs",
            "data/whatsapp_session"
        ]
        
        for directory in directories:
            path = self.root_dir / directory
            path.mkdir(parents=True, exist_ok=True)
        
        self.print_success("Directories created")
        return True
    def ask_virtual_env(self):
        """Ask if user wants to use virtual environment"""
        self.print_header("VIRTUAL ENVIRONMENT")
        
        print("Do you want to use a Python virtual environment?")
        print("(Not required for this Node.js project, but can help with Python dependencies)")
        
        while True:
            response = input(f"{Colors.OKCYAN}Use virtual environment? (y/n): {Colors.ENDC}").lower()
            if response in ['y', 'yes']:
                self.use_venv = True
                break
            elif response in ['n', 'no']:
                self.use_venv = False
                break
            else:
                self.print_warning("Please answer 'y' or 'n'")
        
        if self.use_venv:
            self.print_info("Virtual environment will NOT be created (Node.js handles its own dependencies)")
    
    def collect_configuration(self):
        """Collect configuration from user"""
        self.print_header("CONFIGURATION")
        
        print("Please provide the following configuration values:")
        print(f"{Colors.WARNING}(These will be saved in .env file){Colors.ENDC}\n")
        
        # OpenAI API Key
        while True:
            api_key = input(f"{Colors.OKCYAN}OpenAI API Key: {Colors.ENDC}").strip()
            if api_key and api_key.startswith('sk-'):
                self.config['OPENAI_API_KEY'] = api_key
                break
            else:
                self.print_warning("Invalid API key format. Should start with 'sk-'")
                self.print_info("Get your API key from: https://platform.openai.com/api-keys")
        
        # Telegram Bot Token
        while True:
            bot_token = input(f"{Colors.OKCYAN}Telegram Bot Token: {Colors.ENDC}").strip()
            if bot_token and ':' in bot_token:
                self.config['TELEGRAM_BOT_TOKEN'] = bot_token
                break
            else:
                self.print_warning("Invalid bot token format")
                self.print_info("Get your bot token from: https://t.me/BotFather")
        
        # Telegram Admin ID
        while True:
            admin_id = input(f"{Colors.OKCYAN}Telegram Admin ID (your user ID): {Colors.ENDC}").strip()
            if admin_id.isdigit():
                self.config['TELEGRAM_ADMIN_ID'] = admin_id
                break
            else:
                self.print_warning("Invalid user ID format (should be numbers only)")
                self.print_info("Get your user ID from: https://t.me/userinfobot")
        
        # Log level
        self.config['LOG_LEVEL'] = 'info'
        
        self.print_success("Configuration collected")
    
    def create_env_file(self):
        """Create .env file with configuration"""
        self.print_header("CREATING ENVIRONMENT FILE")
        
        if self.env_file.exists():
            self.print_warning(f".env file already exists at {self.env_file}")
            response = input(f"{Colors.OKCYAN}Overwrite? (y/n): {Colors.ENDC}").lower()
            
            if response not in ['y', 'yes']:
                self.print_info("Keeping existing .env file")
                return True
            
            # Backup existing
            backup = self.env_file.parent / '.env.backup'
            shutil.copy(self.env_file, backup)
            self.print_info(f"Backed up existing .env to {backup}")
        
        # Write .env file
        try:
            with open(self.env_file, 'w') as f:
                f.write("# AnomChatBot Configuration\n")
                f.write("# Generated by install.py\n\n")
                
                for key, value in self.config.items():
                    f.write(f"{key}={value}\n")
            
            self.print_success(f".env file created at {self.env_file}")
            return True
            
        except Exception as e:
            self.print_error(f"Failed to create .env file: {e}")
            return False
    
    def install_dependencies(self):
        """Install Node.js dependencies"""
        self.print_header("INSTALLING DEPENDENCIES")
        
        self.print_info("Installing Node.js packages...")
        self.print_warning("This may take a few minutes...")
        
        # Clean install
        node_modules = self.project_dir / 'node_modules'
        if node_modules.exists():
            self.print_info("Removing existing node_modules...")
            shutil.rmtree(node_modules, ignore_errors=True)
        
        # Install
        success, stdout, stderr = self.run_command("npm install", check=False, capture=False)
        
        if not success:
            self.print_error("Failed to install dependencies")
            self.print_error(f"Error: {stderr}")
            self.print_info("\nTry running manually:")
            self.print_info("  cd " + str(self.project_dir))
            self.print_info("  npm install")
            return False
        
        self.print_success("Dependencies installed successfully")
        return True
    
    def verify_installation(self):
        """Verify installation is correct"""
        self.print_header("VERIFYING INSTALLATION")
        
        # Check node_modules
        node_modules = self.project_dir / 'node_modules'
        if not node_modules.exists():
            self.print_error("node_modules directory not found")
            return False
        
        # Check critical dependencies
        critical_deps = [
            'whatsapp-web.js',
            'node-telegram-bot-api',
            'openai',
            'dotenv',
            'winston'
        ]
        
        for dep in critical_deps:
            dep_path = node_modules / dep
            if dep_path.exists():
                self.print_success(f"✓ {dep}")
            else:
                self.print_error(f"✗ {dep} not found")
                return False
        
        # Check .env file
        if not self.env_file.exists():
            self.print_error(".env file not found")
            return False
        
        self.print_success("✓ .env file")
        
        # Check main files
        main_file = self.project_dir / 'index.js'
        if not main_file.exists():
            self.print_error("index.js not found")
            return False
        
        self.print_success("✓ index.js")
        
        self.print_success("\n✅ Installation verified successfully!")
        return True
    
    def print_next_steps(self):
        """Print next steps for user"""
        self.print_header("INSTALLATION COMPLETE")
        
        print(f"{Colors.OKGREEN}{Colors.BOLD}AnomChatBot is ready to use!{Colors.ENDC}\n")
        
        print(f"{Colors.OKCYAN}Next steps:{Colors.ENDC}")
        print(f"  1. Start the chatbot: {Colors.BOLD}npm start{Colors.ENDC}")
        print(f"     or: {Colors.BOLD}npm run dev{Colors.ENDC}")
        print(f"     or: {Colors.BOLD}node index.js{Colors.ENDC}\n")
        
        print(f"  2. Scan QR code with WhatsApp on your phone\n")
        
        print(f"  3. Use Telegram bot to control conversations\n")
        
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
            ("Browser Check", self.check_chrome_chromium),
            ("Dependencies", self.install_dependencies),
            ("Directories", self.create_directories),
            ("Environment", self.setup_environment),
            ("Git Ignore", self.setup_gitignore),
            ("Systemd Service", self.create_systemd_service),
            ("Verification", self.verify_installation),
        ]
        print(f"{Colors.WARNING}Important:{Colors.ENDC}")
        print(f"  - First message must ALWAYS be sent manually")
        print(f"  - Use /ai command to enable AI after first message")
        print(f"  - Use /help in Telegram for all commands\n")
        
        print(f"{Colors.OKCYAN}Configuration file:{Colors.ENDC} {self.env_file}")
        print(f"{Colors.OKCYAN}Logs directory:{Colors.ENDC} {self.project_dir / 'logs'}\n")
    
    def ask_start_now(self):
        """Ask if user wants to start the bot now"""
        print(f"\n{Colors.BOLD}Do you want to start the chatbot now?{Colors.ENDC}")
        
        while True:
            response = input(f"{Colors.OKCYAN}Start chatbot? (y/n): {Colors.ENDC}").lower()
            
            if response in ['y', 'yes']:
                self.print_info("\nStarting AnomChatBot...")
                self.print_warning("Press Ctrl+C to stop\n")
                
                try:
                    os.chdir(self.project_dir)
                    subprocess.run(["npm", "start"], check=True)
                except KeyboardInterrupt:
                    print(f"\n{Colors.WARNING}Chatbot stopped by user{Colors.ENDC}")
                except Exception as e:
                    self.print_error(f"Failed to start: {e}")
                    self.print_info("\nTry starting manually:")
                    self.print_info(f"  cd {self.project_dir}")
                    self.print_info("  npm start")
                break
                
            elif response in ['n', 'no']:
                self.print_info("You can start the chatbot later with: npm start")
                break
            else:
                self.print_warning("Please answer 'y' or 'n'")
    
    def run(self):
        """Run the installation process"""
        try:
            print(f"{Colors.BOLD}{Colors.HEADER}")
            print("╔════════════════════════════════════════════════════════════╗")
            print("║                                                            ║")
            print("║              AnomChatBot Installation Script              ║")
            print("║                                                            ║")
            print("║     Production-Ready WhatsApp ↔ Telegram ↔ AI Bridge    ║")
            print("║                                                            ║")
            print("╚════════════════════════════════════════════════════════════╝")
            print(f"{Colors.ENDC}\n")
            
            # Step 1: Check requirements
            if not self.check_system_requirements():
                self.print_error("\nSystem requirements not met. Please fix issues and try again.")
                return False
            
            # Step 2: Ask about virtual env
            self.ask_virtual_env()
            
            # Step 3: Collect configuration
            self.collect_configuration()
            
            # Step 4: Create .env file
            if not self.create_env_file():
                return False
            
            # Step 5: Install dependencies
            if not self.install_dependencies():
                return False
            
            # Step 6: Verify installation
            if not self.verify_installation():
                self.print_error("\nInstallation verification failed")
                return False
            
            # Step 7: Print next steps
            self.print_next_steps()
            
            # Step 8: Ask to start
            self.ask_start_now()
            
            return True
            
        except KeyboardInterrupt:
            print(f"\n\n{Colors.WARNING}Installation cancelled by user{Colors.ENDC}")
            return False
        except Exception as e:
            self.print_error(f"\nUnexpected error: {e}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == '__main__':
    installer = AnomChatBotInstaller()
    success = installer.run()
    sys.exit(0 if success else 1)
