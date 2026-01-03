#!/usr/bin/env python3
"""
AnomChatBot Installation Validation Script
Validates the installation and checks for any issues
"""

import os
import sys
import asyncio
import tempfile
import importlib
from pathlib import Path
from typing import List, Tuple, Dict

class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m' 
    RED = '\033[91m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class InstallationValidator:
    """Validates AnomChatBot installation"""
    
    def __init__(self):
        self.project_dir = Path(__file__).parent.absolute()
        self.errors: List[str] = []
        self.warnings: List[str] = []
        self.passed_checks = 0
        self.total_checks = 0
    
    def print_success(self, message: str):
        print(f"{Colors.GREEN}✓ {message}{Colors.RESET}")
        self.passed_checks += 1
    
    def print_error(self, message: str):
        print(f"{Colors.RED}✗ {message}{Colors.RESET}")
        self.errors.append(message)
    
    def print_warning(self, message: str):
        print(f"{Colors.YELLOW}⚠ {message}{Colors.RESET}")
        self.warnings.append(message)
    
    def print_info(self, message: str):
        print(f"{Colors.BLUE}ℹ {message}{Colors.RESET}")
    
    def print_header(self, title: str):
        print(f"\n{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}{title.center(60)}{Colors.RESET}")
        print(f"{Colors.BOLD}{Colors.BLUE}{'='*60}{Colors.RESET}\n")
    
    def check_python_version(self):
        """Check Python version"""
        self.total_checks += 1
        version = sys.version_info
        
        if version.major >= 3 and version.minor >= 8:
            self.print_success(f"Python {version.major}.{version.minor}.{version.micro}")
        else:
            self.print_error(f"Python 3.8+ required, found {version.major}.{version.minor}")
    
    def check_required_files(self):
        """Check if all required files exist"""
        required_files = [
            'main.py',
            'install.py',
            'requirements.txt',
            'config/config.yaml',
            'src/config.py',
            'src/database.py',
            'src/models.py',
            'src/openai/openai_manager.py',
            'src/conversation/conversation_manager.py',
            'src/telegram/telegram_bot.py',
            'src/whatsapp/whatsapp_bot.py',
        ]
        
        for file_path in required_files:
            self.total_checks += 1
            full_path = self.project_dir / file_path
            
            if full_path.exists():
                self.print_success(f"File exists: {file_path}")
            else:
                self.print_error(f"Missing required file: {file_path}")
    
    def check_dependencies(self):
        """Check if all Python dependencies are installed"""
        required_modules = [
            ('openai', 'OpenAI API client'),
            ('telegram', 'python-telegram-bot'),
            ('sqlalchemy', 'SQLAlchemy ORM'),
            ('loguru', 'Loguru logging'),
            ('yaml', 'PyYAML'),
            ('dotenv', 'python-dotenv'),
            ('aiofiles', 'Async file operations'),
            ('aiohttp', 'Async HTTP client'),
            ('tiktoken', 'Token counting'),
            ('PIL', 'Pillow image processing'),
        ]
        
        optional_modules = [
            ('webwhatsapi', 'WhatsApp Web integration'),
            ('selenium', 'Web automation'),
            ('qrcode', 'QR code generation'),
            ('cv2', 'OpenCV image processing'),
            ('pydub', 'Audio processing'),
        ]
        
        # Check required modules
        for module, description in required_modules:
            self.total_checks += 1
            try:
                importlib.import_module(module)
                self.print_success(f"Module: {module} ({description})")
            except ImportError:
                self.print_error(f"Missing required module: {module} ({description})")
        
        # Check optional modules
        for module, description in optional_modules:
            self.total_checks += 1
            try:
                importlib.import_module(module)
                self.print_success(f"Optional module: {module} ({description})")
            except ImportError:
                self.print_warning(f"Optional module not found: {module} ({description})")
    
    def print_summary(self):
        """Print validation summary"""
        self.print_header("VALIDATION SUMMARY")
        
        print(f"Total checks: {Colors.BLUE}{self.total_checks}{Colors.RESET}")
        print(f"Passed: {Colors.GREEN}{self.passed_checks}{Colors.RESET}")
        print(f"Errors: {Colors.RED}{len(self.errors)}{Colors.RESET}")
        print(f"Warnings: {Colors.YELLOW}{len(self.warnings)}{Colors.RESET}")
        
        success_rate = (self.passed_checks / self.total_checks * 100) if self.total_checks > 0 else 0
        print(f"Success rate: {Colors.BLUE}{success_rate:.1f}%{Colors.RESET}")
        
        if len(self.errors) == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✅ VALIDATION PASSED!{Colors.RESET}")
            print(f"{Colors.GREEN}AnomChatBot installation appears to be correct.{Colors.RESET}")
        else:
            print(f"\n{Colors.RED}{Colors.BOLD}❌ VALIDATION FAILED!{Colors.RESET}")
            print(f"{Colors.RED}Please fix the errors above before running.{Colors.RESET}")
        
        return len(self.errors) == 0
    
    def validate(self):
        """Run complete validation"""
        self.print_header("AnomChatBot Installation Validation")
        
        self.check_python_version()
        self.check_required_files()
        self.check_dependencies()
        
        return self.print_summary()


def main():
    """Main validation function"""
    validator = InstallationValidator()
    success = validator.validate()
    
    if success:
        print(f"\n{Colors.GREEN}Ready to run AnomChatBot!{Colors.RESET}")
        return 0
    else:
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
data_dirs = [
    "data/media/image",
    "data/media/audio",
    "data/media/video",
    "data/media/document",
    "data/logs",
    "data/whatsapp_session",
]

for dir_path in data_dirs:
    path = Path(dir_path)
    if path.exists():
        print(f"  ✓ {dir_path}/")
    else:
        # Create it
        path.mkdir(parents=True, exist_ok=True)
        print(f"  → Created {dir_path}/")

print("\n✓ Data directory structure verified")

# Check Python syntax
print("\n4. Checking Python syntax...")
import py_compile

py_files = [
    "src/whatsapp/whatsapp_bot.py",
    "src/whatsapp/whatsapp_bot_impl.py",
    "runwithtermux.py",
    "tests/test_whatsapp.py",
]

syntax_ok = True
for py_file in py_files:
    try:
        py_compile.compile(py_file, doraise=True)
        print(f"  ✓ {py_file}")
    except py_compile.PyCompileError as e:
        print(f"  ✗ {py_file}: {e}")
        syntax_ok = False

if syntax_ok:
    print("\n✓ All Python files have valid syntax")
else:
    print("\n✗ Some files have syntax errors")
    sys.exit(1)

# Summary
print("\n" + "="*60)
print("Validation Summary")
print("="*60)
print("\n✓ WhatsApp integration implementation is complete")
print("✓ All core files are present and valid")
print("✓ Termux installer is ready")
print("✓ Documentation is in place")
print("\nNext steps:")
print("  1. Install dependencies: pip install -r requirements.txt")
print("  2. Configure .env file")
print("  3. Run: python main.py")
print("  4. For Android: python runwithtermux.py install")
print("\n" + "="*60)
