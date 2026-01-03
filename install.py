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
import json
import tempfile
import platform
from pathlib import Path
from typing import Tuple, Dict, Any, List, Optional

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
        self.warnings: List[str] = []
        self.created_files: List[Path] = []
        self.is_windows = platform.system().lower() == 'windows'
        self.is_linux = platform.system().lower() == 'linux'
        self.is_macos = platform.system().lower() == 'darwin'
        
    def print_header(self, text: str) -> None:
        """Print formatted header"""
        print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{text.center(60)}{Colors.ENDC}")
        print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")
    
    def print_success(self, text: str) -> None:
        """Print success message"""
        print(f"{Colors.OKGREEN}✓ {text}{Colors.ENDC}")
    
    def print_error(self, text: str) -> None:
        """Print error message"""
        print(f"{Colors.FAIL}✗ {text}{Colors.ENDC}")
    
    def print_warning(self, text: str) -> None:
        """Print warning message"""
        print(f"{Colors.WARNING}⚠ {text}{Colors.ENDC}")
    
    def print_info(self, text: str) -> None:
        """Print info message"""
        print(f"{Colors.OKCYAN}ℹ {text}{Colors.ENDC}")
    
    def run_command(self, cmd: str, check: bool = True, capture: bool = True, 
                   timeout: int = 300) -> Tuple[bool, str, str]:
        """Run shell command with error handling and timeout
        
        Args:
            cmd: Command as string
            check: Whether to check return code
            capture: Whether to capture output
            timeout: Command timeout in seconds
            
        Returns:
            Tuple of (success, stdout, stderr)
        """
        try:
            # Use shlex.split for proper shell-like splitting
            cmd_list = shlex.split(cmd) if not self.is_windows else cmd.split()
            
            if capture:
                result = subprocess.run(
                    cmd_list,
                    shell=self.is_windows,
                    check=check,
                    capture_output=True,
                    text=True,
                    timeout=timeout
                )
                return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
            else:
                result = subprocess.run(
                    cmd_list, 
                    shell=self.is_windows, 
                    check=check,
                    timeout=timeout
                )
                return result.returncode == 0, "", ""
        except (TypeError, FileNotFoundError, subprocess.CalledProcessError, 
                subprocess.TimeoutExpired) as e:
            return False, "", str(e)
    
    def create_rollback_point(self) -> Dict[str, Any]:
        """Create a rollback point"""
        return {
            'created_files': self.created_files.copy(),
            'env_backup': self.env_file.read_text() if self.env_file.exists() else None,
        }
    
    def rollback(self, rollback_point: Dict[str, Any]) -> None:
        """Rollback changes"""
        self.print_warning("Rolling back changes...")
        
        # Remove created files
        for file_path in rollback_point.get('created_files', []):
            try:
                if file_path.exists():
                    if file_path.is_file():
                        file_path.unlink()
                    elif file_path.is_dir():
                        shutil.rmtree(file_path)
                    self.print_info(f"Removed: {file_path}")
            except Exception as e:
                self.print_warning(f"Could not remove {file_path}: {e}")
        
        # Restore .env file
        env_backup = rollback_point.get('env_backup')
        if env_backup:
            try:
                self.env_file.write_text(env_backup)
                self.print_info("Restored .env file")
            except Exception as e:
                self.print_warning(f"Could not restore .env: {e}")
    
    def validate_python_version(self) -> bool:
        """Validate Python version >= 3.8"""
        version = sys.version_info
        if version.major < 3 or (version.major == 3 and version.minor < 8):
            self.print_error(f"Python 3.8+ required, found {version.major}.{version.minor}")
            return False
        self.print_success(f"Python {version.major}.{version.minor}.{version.micro}")
        return True
    
    def check_system_requirements(self) -> bool:
        """Check if system meets requirements"""
        self.print_header("CHECKING SYSTEM REQUIREMENTS")
        
        # Check OS
        system = platform.system()
        self.print_info(f"Operating System: {system} {platform.release()}")
        
        if not (self.is_linux or self.is_macos or self.is_windows):
            self.print_warning(f"Untested OS: {system}. May have issues.")
        
        # Check Python version
        if not self.validate_python_version():
            return False
        
        # Check pip
        self.print_info("Checking pip installation...")
        pip_cmd = 'pip3' if not self.is_windows else 'pip'
        success, stdout, stderr = self.run_command(f"{pip_cmd} --version")
        
        if not success:
            self.print_error("pip is not installed!")
            return False
        
        self.print_success(f"pip: {stdout.split()[1]}")
        
        # Check Node.js (for JS components)
        self.print_info("Checking Node.js installation...")
        success, stdout, stderr = self.run_command("node --version")
        
        if not success:
            self.print_warning("Node.js not found (optional for full features)")
            self.print_info("Install from: https://nodejs.org/")
        else:
            self.print_success(f"Node.js: {stdout}")
        
        return True
    
    def check_chrome_chromium(self) -> bool:
        """Check if Chrome/Chromium is available (for WhatsApp Web)"""
        self.print_info("Checking for Chrome/Chromium...")
        
        browsers = [
            'chromium', 'chromium-browser', 'google-chrome', 'chrome',
            '/usr/bin/chromium', '/usr/bin/chromium-browser',
            '/usr/bin/google-chrome', '/opt/google/chrome/chrome'
        ]
        
        for browser in browsers:
            success, _, _ = self.run_command(f'which {browser}' if not self.is_windows else f'where {browser}')
            if success:
                self.print_success(f"Found browser: {browser}")
                return True
        
        self.print_warning("Chrome/Chromium not found. WhatsApp Web may not work.")
        if self.is_linux:
            self.print_info("Install with: sudo apt install chromium-browser")
        elif self.is_windows:
            self.print_info("Download Chrome from: https://www.google.com/chrome/")
        elif self.is_macos:
            self.print_info("Install with: brew install --cask google-chrome")
        
        return True  # Not fatal, return True to continue
    
    def create_directories(self) -> bool:
        """Create necessary directories"""
        self.print_info("Creating directories...")
        
        directories = [
            "data/conversations",
            "data/media/images",
            "data/media/audio", 
            "data/media/video",
            "data/media/documents",
            "data/logs",
            "data/whatsapp_session",
            "data/qr_codes",
            "logs",
            ".wwebjs_auth"
        ]
        
        created_dirs = []
        try:
            for directory in directories:
                path = self.project_dir / directory
                if not path.exists():
                    path.mkdir(parents=True, exist_ok=True, mode=0o755)
                    created_dirs.append(path)
                    self.created_files.append(path)
            
            self.print_success(f"Created {len(created_dirs)} directories")
            return True
            
        except Exception as e:
            self.print_error(f"Failed to create directories: {e}")
            return False
    
    def install_python_dependencies(self) -> bool:
        """Install Python dependencies"""
        self.print_info("Installing Python dependencies...")
        
        requirements_file = self.project_dir / "requirements.txt"
        if not requirements_file.exists():
            self.print_error("requirements.txt not found")
            return False
        
        pip_cmd = 'pip3' if not self.is_windows else 'pip'
        self.print_info("This may take several minutes...")
        
        # Upgrade pip first
        success, _, stderr = self.run_command(f"{pip_cmd} install --upgrade pip", timeout=120)
        if not success:
            self.print_warning(f"Could not upgrade pip: {stderr}")
        
        # Install requirements
        success, stdout, stderr = self.run_command(
            f"{pip_cmd} install -r {requirements_file}", timeout=600
        )
        
        if not success:
            self.print_error(f"Failed to install Python dependencies: {stderr}")
            self.print_info("Try manually with:")
            self.print_info(f"  {pip_cmd} install -r requirements.txt")
            return False
        
        self.print_success("Python dependencies installed")
        return True
    
    def install_node_dependencies(self) -> bool:
        """Install Node.js dependencies if package.json exists"""
        package_json = self.project_dir / "package.json"
        if not package_json.exists():
            self.print_info("No package.json found, skipping Node.js dependencies")
            return True
        
        self.print_info("Installing Node.js dependencies...")
        self.print_info("⚠ This may take a few minutes...")
        self.print_info("ℹ Note: Some deprecation warnings are expected from transitive dependencies")
        
        # Check if npm is available
        success, _, _ = self.run_command("npm --version")
        if not success:
            self.print_warning("npm not found, skipping Node.js dependencies")
            return True
        
        # Clean install
        node_modules = self.project_dir / 'node_modules'
        if node_modules.exists():
            self.print_info("ℹ Removing existing node_modules...")
            shutil.rmtree(node_modules, ignore_errors=True)
        
        # Install dependencies
        success, stdout, stderr = self.run_command("npm install", timeout=600)
        
        if not success:
            self.print_warning(f"Failed to install Node.js dependencies: {stderr}")
            self.print_info("This is optional for Python-only operation")
            self.print_info("If WhatsApp functionality is needed, try:")
            self.print_info("  npm install")
            self.print_info("  npx puppeteer browsers install chrome")
        else:
            self.print_success("Dependencies installed successfully")
            
            # Check for common issues
            if "puppeteer" in stderr.lower() or "chromium" in stderr.lower():
                self.warnings.append("Chromium download may have failed. If WhatsApp doesn't work, run: npx puppeteer browsers install chrome")
        
        return True
    
    def collect_configuration(self) -> bool:
        """Collect configuration from user"""
        self.print_header("CONFIGURATION")
        
        print("Please provide the following configuration values:")
        print(f"{Colors.WARNING}(These will be saved in .env file){Colors.ENDC}\n")
        
        # OpenAI API Key
        while True:
            api_key = input(f"{Colors.OKCYAN}OpenAI API Key: {Colors.ENDC}").strip()
            if not api_key:
                self.print_warning("API key is required")
                continue
            if not api_key.startswith(('sk-', 'org-')):
                self.print_warning("Invalid API key format. Should start with 'sk-' or 'org-'")
                self.print_info("Get your API key from: https://platform.openai.com/api-keys")
                continue
            self.config['OPENAI_API_KEY'] = api_key
            break
        
        # OpenAI Model
        print(f"\n{Colors.OKCYAN}Available OpenAI models:{Colors.ENDC}")
        models = ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo', 'gpt-4o']
        for i, model in enumerate(models, 1):
            print(f"  {i}. {model}")
        
        while True:
            choice = input(f"{Colors.OKCYAN}Select model (1-{len(models)}) [1]: {Colors.ENDC}").strip()
            if not choice:
                choice = '1'
            try:
                index = int(choice) - 1
                if 0 <= index < len(models):
                    self.config['OPENAI_MODEL'] = models[index]
                    break
                else:
                    self.print_warning(f"Please enter a number between 1 and {len(models)}")
            except ValueError:
                self.print_warning("Please enter a valid number")
        
        # Telegram Bot Token
        while True:
            bot_token = input(f"\n{Colors.OKCYAN}Telegram Bot Token: {Colors.ENDC}").strip()
            if not bot_token:
                self.print_warning("Bot token is required")
                continue
            if ':' not in bot_token or not bot_token.split(':')[0].isdigit():
                self.print_warning("Invalid bot token format (should be: 123456:ABC-DEF...)")
                self.print_info("Get your bot token from: https://t.me/BotFather")
                continue
            self.config['TELEGRAM_BOT_TOKEN'] = bot_token
            break
        
        # Telegram Admin IDs
        print(f"\n{Colors.OKCYAN}Telegram Admin IDs (comma-separated):{Colors.ENDC}")
        print(f"{Colors.WARNING}Get your user ID from: https://t.me/userinfobot{Colors.ENDC}")
        
        while True:
            admin_ids = input(f"{Colors.OKCYAN}Admin IDs: {Colors.ENDC}").strip()
            if not admin_ids:
                self.print_warning("At least one admin ID is required")
                continue
            
            # Validate admin IDs
            ids = [aid.strip() for aid in admin_ids.split(',')]
            valid_ids = []
            invalid = False
            
            for aid in ids:
                if aid.isdigit() and len(aid) >= 5:
                    valid_ids.append(aid)
                else:
                    self.print_warning(f"Invalid admin ID: {aid}")
                    invalid = True
                    
            if invalid:
                continue
            
            self.config['TELEGRAM_ADMIN_IDS'] = ','.join(valid_ids)
            break
        
        # Additional optional settings
        self.config['DATABASE_URL'] = 'sqlite+aiosqlite:///./data/conversations.db'
        self.config['LOG_LEVEL'] = 'INFO'
        self.config['WHATSAPP_SESSION_PATH'] = './data/whatsapp_session'
        self.config['DEFAULT_TEMPERATURE'] = '0.7'
        self.config['DEFAULT_MAX_TOKENS'] = '2000'
        self.config['MAX_CONVERSATION_HISTORY'] = '50'
        
        self.print_success("Configuration collected successfully")
        return True
    
    def create_env_file(self) -> bool:
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
            try:
                shutil.copy(self.env_file, backup)
                self.print_info(f"Backed up existing .env to {backup}")
            except Exception as e:
                self.print_warning(f"Could not backup .env: {e}")
        
        # Write .env file
        try:
            env_content = [
                "# AnomChatBot Configuration",
                "# Generated by install.py",
                f"# Created: {os.environ.get('USER', 'unknown')}@{platform.node()} on {platform.system()}",
                "",
                "# OpenAI Configuration",
                f"OPENAI_API_KEY={self.config['OPENAI_API_KEY']}",
                f"OPENAI_MODEL={self.config['OPENAI_MODEL']}",
                f"DEFAULT_TEMPERATURE={self.config['DEFAULT_TEMPERATURE']}",
                f"DEFAULT_MAX_TOKENS={self.config['DEFAULT_MAX_TOKENS']}",
                "",
                "# Telegram Configuration", 
                f"TELEGRAM_BOT_TOKEN={self.config['TELEGRAM_BOT_TOKEN']}",
                f"TELEGRAM_ADMIN_IDS={self.config['TELEGRAM_ADMIN_IDS']}",
                "",
                "# WhatsApp Configuration",
                f"WHATSAPP_SESSION_PATH={self.config['WHATSAPP_SESSION_PATH']}",
                "",
                "# Database Configuration",
                f"DATABASE_URL={self.config['DATABASE_URL']}",
                "",
                "# Application Settings",
                f"LOG_LEVEL={self.config['LOG_LEVEL']}",
                f"MAX_CONVERSATION_HISTORY={self.config['MAX_CONVERSATION_HISTORY']}",
                "AUTO_SAVE_INTERVAL=60",
                "",
                "# Security",
                "SECURE_SESSION=true",
                "RATE_LIMIT_ENABLED=true",
                ""
            ]
            
            self.env_file.write_text('\n'.join(env_content) + '\n')
            self.created_files.append(self.env_file)
            self.print_success(f".env file created at {self.env_file}")
            return True
            
        except Exception as e:
            self.print_error(f"Failed to create .env file: {e}")
            return False
    
    def create_systemd_service(self) -> bool:
        """Create systemd service file (Linux only)"""
        if not self.is_linux:
            self.print_info("Systemd service creation skipped (not Linux)")
            return True
        
        self.print_header("CREATING SYSTEMD SERVICE")
        
        service_content = f"""[Unit]
Description=AnomChatBot - WhatsApp Telegram Bridge
After=network.target
Wants=network.target

[Service]
Type=simple
User={os.environ.get('USER', 'anomchatbot')}
WorkingDirectory={self.project_dir}
Environment=PATH={os.environ.get('PATH', '')}
ExecStart=/usr/bin/python3 {self.project_dir}/main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
"""
        
        service_file = self.project_dir / 'systemd' / 'anomchatbot.service'
        try:
            service_file.parent.mkdir(exist_ok=True)
            service_file.write_text(service_content)
            self.created_files.append(service_file)
            self.print_success(f"Systemd service created: {service_file}")
            
            self.print_info("To install the service:")
            self.print_info(f"  sudo cp {service_file} /etc/systemd/system/")
            self.print_info("  sudo systemctl daemon-reload")
            self.print_info("  sudo systemctl enable anomchatbot")
            self.print_info("  sudo systemctl start anomchatbot")
            
            return True
        except Exception as e:
            self.print_warning(f"Could not create systemd service: {e}")
            return True  # Non-fatal
    
    def verify_installation(self) -> bool:
        """Verify installation is correct"""
        self.print_header("VERIFYING INSTALLATION")
        
        # Check .env file
        if not self.env_file.exists():
            self.print_error(".env file not found")
            return False
        self.print_success("✓ .env file")
        
        # Check main files
        main_files = ['main.py', 'requirements.txt', 'src/config.py']
        for file_path in main_files:
            file_obj = self.project_dir / file_path
            if not file_obj.exists():
                self.print_error(f"Required file not found: {file_path}")
                return False
            self.print_success(f"✓ {file_path}")
        
        # Validate Python dependencies
        self.print_info("Validating Python dependencies...")
        critical_modules = [
            'openai', 'telegram', 'sqlalchemy', 'loguru', 'yaml',
            'dotenv', 'selenium', 'aiofiles'
        ]
        
        for module in critical_modules:
            try:
                __import__(module.replace('-', '_'))
                self.print_success(f"✓ {module}")
            except ImportError:
                self.print_error(f"✗ {module} not installed")
                return False
        
        # Test configuration loading
        try:
            sys.path.insert(0, str(self.project_dir / 'src'))
            from config import get_config
            config = get_config()
            if config.validate():
                self.print_success("✓ Configuration validation")
            else:
                self.print_error("✗ Configuration validation failed")
                return False
        except Exception as e:
            self.print_error(f"✗ Configuration test failed: {e}")
            return False
        
        self.print_success("\n✅ Installation verified successfully!")
        return True
    
    def print_next_steps(self) -> None:
        """Print next steps for user"""
        self.print_header("INSTALLATION COMPLETE")
        
        print(f"{Colors.OKGREEN}{Colors.BOLD}🎉 AnomChatBot is ready to use!{Colors.ENDC}\n")
        
        print(f"{Colors.OKCYAN}Next steps:{Colors.ENDC}")
        print(f"  1. Start the chatbot: npm start")
        print(f"     or: npm run dev")
        print(f"     or: node index.js")
        print()
        
        print(f"  2. Scan QR code with WhatsApp on your phone")
        print()
        
        print(f"  3. Use Telegram bot to control conversations")
        print()
        
        print(f"{Colors.WARNING}⚠ If WhatsApp fails to connect (Chrome/Chromium error):{Colors.ENDC}")
        print(f"     {Colors.BOLD}npx puppeteer browsers install chrome{Colors.ENDC}")
        print()
        
        print(f"  3. Usage:")
        print(f"     • First message must ALWAYS be sent manually")
        print(f"     • Use Telegram commands to control conversations")
        print(f"     • Use /help in Telegram for all commands")
        print()
        
        if self.is_linux:
            print(f"  4. Service management (optional):")
            print(f"     {Colors.BOLD}sudo systemctl start anomchatbot{Colors.ENDC}")
            print(f"     {Colors.BOLD}sudo systemctl enable anomchatbot{Colors.ENDC}")
            print()
        
        print(f"{Colors.OKCYAN}Important files:{Colors.ENDC}")
        print(f"  Configuration: {Colors.BOLD}{self.env_file}{Colors.ENDC}")
        print(f"  Logs: {Colors.BOLD}{self.project_dir}/data/logs/{Colors.ENDC}")
        print(f"  Database: {Colors.BOLD}{self.project_dir}/data/conversations.db{Colors.ENDC}")
        
        # Check for warnings with safe fallback
        warnings_list = getattr(self, 'warnings', [])
        if warnings_list:
            print(f"\n{Colors.WARNING}{Colors.BOLD}⚠ Warnings:{Colors.ENDC}")
            for warning in warnings_list:
                print(f"   • {warning}")
    
    def ask_start_now(self) -> None:
        """Ask if user wants to start the bot now"""
        print(f"\n{Colors.BOLD}Do you want to start the chatbot now?{Colors.ENDC}")
        print(f"{Colors.WARNING}Note: First run will require QR code scanning{Colors.ENDC}")
        
        while True:
            response = input(f"{Colors.OKCYAN}Start chatbot? (y/n): {Colors.ENDC}").lower()
            
            if response in ['y', 'yes']:
                self.print_info("\nStarting AnomChatBot...")
                self.print_warning("Press Ctrl+C to stop\n")
                
                try:
                    os.chdir(self.project_dir)
                    subprocess.run([sys.executable, "main.py"], check=True)
                except KeyboardInterrupt:
                    print(f"\n{Colors.WARNING}Chatbot stopped by user{Colors.ENDC}")
                except Exception as e:
                    self.print_error(f"Failed to start: {e}")
                    self.print_info("\nTry starting manually:")
                    self.print_info(f"  cd {self.project_dir}")
                    self.print_info(f"  python3 main.py")
                break
                
            elif response in ['n', 'no']:
                self.print_info("You can start the chatbot later with:")
                self.print_info(f"  cd {self.project_dir}")
                self.print_info(f"  python3 main.py")
                break
            else:
                self.print_warning("Please answer 'y' or 'n'")
    
    def run(self) -> bool:
        """Run the installation process"""
        rollback_point = None
        
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
            
            # Create rollback point
            rollback_point = self.create_rollback_point()
            
            # Step 1: Check system requirements
            if not self.check_system_requirements():
                self.print_error("\nSystem requirements not met. Please fix issues and try again.")
                return False
            
            # Step 2: Check browser
            self.check_chrome_chromium()
            
            # Step 3: Create directories
            if not self.create_directories():
                raise RuntimeError("Failed to create directories")
            
            # Step 4: Collect configuration
            if not self.collect_configuration():
                raise RuntimeError("Failed to collect configuration")
            
            # Step 5: Create .env file
            if not self.create_env_file():
                raise RuntimeError("Failed to create .env file")
            
            # Step 6: Install dependencies
            if not self.install_python_dependencies():
                raise RuntimeError("Failed to install Python dependencies")
            
            # Step 7: Install Node.js dependencies (optional)
            self.install_node_dependencies()  # Non-fatal
            
            # Step 8: Create systemd service (Linux only)
            self.create_systemd_service()  # Non-fatal
            
            # Step 9: Verify installation
            if not self.verify_installation():
                raise RuntimeError("Installation verification failed")
            
            # Step 10: Print next steps
            self.print_next_steps()
            
            # Step 11: Ask to start
            self.ask_start_now()
            
            self.print_success(f"\n🎉 {Colors.BOLD}Installation completed successfully!{Colors.ENDC}")
            return True
            
        except KeyboardInterrupt:
            print(f"\n\n{Colors.WARNING}Installation cancelled by user{Colors.ENDC}")
            if rollback_point:
                self.rollback(rollback_point)
            return False
        except Exception as e:
            self.print_error(f"\nInstallation failed: {e}")
            if rollback_point:
                self.rollback(rollback_point)
            return False

if __name__ == '__main__':
    installer = AnomChatBotInstaller()
    success = installer.run()
    
    if success:
        print(f"\n{Colors.OKGREEN}SUCCESS: AnomChatBot installation completed!{Colors.ENDC}")
        sys.exit(0)
    else:
        print(f"\n{Colors.FAIL}FAILURE: AnomChatBot installation failed!{Colors.ENDC}")
        print(f"{Colors.FAIL}Please check the errors above and try again.{Colors.ENDC}")
        sys.exit(1)
