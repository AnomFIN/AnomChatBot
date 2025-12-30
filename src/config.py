"""
Configuration manager for AnomChatBot
"""
import os
import yaml
import threading
from typing import Dict, Any, Optional
from pathlib import Path
from dotenv import load_dotenv
from loguru import logger


class Config:
    """Application configuration manager"""
    
    def __init__(self, config_path: Optional[str] = None, env_path: Optional[str] = None):
        # Load environment variables
        if env_path:
            load_dotenv(env_path)
        else:
            load_dotenv()
        
        # Load YAML configuration
        self.config_path = config_path or os.path.join(
            Path(__file__).parent.parent, 'config', 'config.yaml'
        )
        self.config_data = self._load_yaml_config()
        
        # Initialize configuration sections
        self._init_openai_config()
        self._init_telegram_config()
        self._init_whatsapp_config()
        self._init_database_config()
        self._init_app_config()
        self._init_media_config()
        self._init_logging_config()
    
    def _load_yaml_config(self) -> Dict[str, Any]:
        """Load YAML configuration file"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f) or {}
        except FileNotFoundError:
            logger.warning(f"Config file not found: {self.config_path}, using defaults")
            return {}
        except Exception as e:
            logger.error(f"Error loading config file: {e}")
            return {}
    
    def _init_openai_config(self):
        """Initialize OpenAI configuration"""
        self.openai_api_key = os.getenv('OPENAI_API_KEY')
        self.openai_model = os.getenv('OPENAI_MODEL', 'gpt-4-turbo-preview')
        self.default_temperature = float(os.getenv('DEFAULT_TEMPERATURE', '0.7'))
        self.default_max_tokens = int(os.getenv('DEFAULT_MAX_TOKENS', '2000'))
        self.default_system_prompt = os.getenv(
            'DEFAULT_SYSTEM_PROMPT',
            'Olet avulias ja ystävällinen assistentti joka vastaa suomeksi.'
        )
    
    def _init_telegram_config(self):
        """Initialize Telegram configuration"""
        self.telegram_bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        admin_ids_str = os.getenv('TELEGRAM_ADMIN_IDS', '')
        self.telegram_admin_ids = [
            int(aid.strip()) for aid in admin_ids_str.split(',') if aid.strip()
        ]
    
    def _init_whatsapp_config(self):
        """Initialize WhatsApp configuration"""
        self.whatsapp_session_path = os.getenv(
            'WHATSAPP_SESSION_PATH', 
            './data/whatsapp_session'
        )
    
    def _init_database_config(self):
        """Initialize database configuration"""
        self.database_url = os.getenv(
            'DATABASE_URL',
            'sqlite+aiosqlite:///./data/conversations.db'
        )
    
    def _init_app_config(self):
        """Initialize application configuration"""
        self.log_level = os.getenv('LOG_LEVEL', 'INFO')
        self.max_conversation_history = int(os.getenv('MAX_CONVERSATION_HISTORY', '50'))
        self.auto_save_interval = int(os.getenv('AUTO_SAVE_INTERVAL', '60'))
        
        # Bot settings from YAML
        bot_config = self.config_data.get('bot', {})
        self.bot_name = bot_config.get('name', 'AnomChatBot')
        self.bot_version = bot_config.get('version', '1.0.0')
        self.default_language = bot_config.get('default_language', 'fi')
        self.response_delay_min = bot_config.get('response_delay_min', 1)
        self.response_delay_max = bot_config.get('response_delay_max', 3)
        
        # Conversation settings
        conv_config = self.config_data.get('conversation', {})
        self.auto_archive_days = conv_config.get('auto_archive_days', 30)
        self.enable_context_memory = conv_config.get('enable_context_memory', True)
        self.tone_levels = conv_config.get('tone_levels', {})
        self.flirt_levels = conv_config.get('flirt_levels', {})
        
        # Prompts
        prompts_config = self.config_data.get('prompts', {})
        self.base_prompt = prompts_config.get('base', self.default_system_prompt)
        self.tone_modifiers = prompts_config.get('tone_modifiers', {})
        self.flirt_modifiers = prompts_config.get('flirt_modifiers', {})
    
    def _init_media_config(self):
        """Initialize media configuration"""
        self.max_image_size = int(os.getenv('MAX_IMAGE_SIZE', '5242880'))  # 5MB
        self.max_video_size = int(os.getenv('MAX_VIDEO_SIZE', '52428800'))  # 50MB
        self.max_audio_size = int(os.getenv('MAX_AUDIO_SIZE', '10485760'))  # 10MB
        
        formats = os.getenv('SUPPORTED_IMAGE_FORMATS', 'jpg,jpeg,png,gif,webp')
        self.supported_image_formats = [f.strip() for f in formats.split(',')]
        
        formats = os.getenv('SUPPORTED_VIDEO_FORMATS', 'mp4,mov,avi')
        self.supported_video_formats = [f.strip() for f in formats.split(',')]
        
        formats = os.getenv('SUPPORTED_AUDIO_FORMATS', 'mp3,wav,ogg,m4a')
        self.supported_audio_formats = [f.strip() for f in formats.split(',')]
        
        # Media settings from YAML
        media_config = self.config_data.get('media', {})
        self.enable_image_analysis = media_config.get('enable_image_analysis', True)
        self.enable_video_analysis = media_config.get('enable_video_analysis', True)
        self.enable_audio_transcription = media_config.get('enable_audio_transcription', True)
    
    def _init_logging_config(self):
        """Initialize logging configuration"""
        log_config = self.config_data.get('logging', {})
        self.log_format = log_config.get(
            'format',
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.log_max_file_size = log_config.get('max_file_size', 10485760)  # 10MB
        self.log_backup_count = log_config.get('backup_count', 5)
    
    def get_system_prompt(
        self, 
        tone_level: float = 0.5, 
        flirt_level: float = 0.0,
        custom_prompt: Optional[str] = None
    ) -> str:
        """Generate system prompt based on settings"""
        if custom_prompt:
            return custom_prompt
        
        # Start with base prompt
        prompt = self.base_prompt
        
        # Add tone modifier
        tone_key = self._get_level_key(tone_level, self.tone_levels)
        if tone_key and tone_key in self.tone_modifiers:
            prompt += f" {self.tone_modifiers[tone_key]}"
        
        # Add flirt modifier
        flirt_key = self._get_level_key(flirt_level, self.flirt_levels)
        if flirt_key and flirt_key in self.flirt_modifiers:
            flirt_text = self.flirt_modifiers[flirt_key]
            if flirt_text:
                prompt += f" {flirt_text}"
        
        return prompt
    
    def _get_level_key(self, level: float, level_dict: Dict[str, float]) -> Optional[str]:
        """Get the key for a given level value"""
        closest_key = None
        closest_diff = float('inf')
        
        for key, value in level_dict.items():
            diff = abs(value - level)
            if diff < closest_diff:
                closest_diff = diff
                closest_key = key
        
        return closest_key
    
    def validate(self) -> bool:
        """Validate required configuration"""
        errors = []
        
        if not self.openai_api_key:
            errors.append("OPENAI_API_KEY is not set")
        
        if not self.telegram_bot_token:
            errors.append("TELEGRAM_BOT_TOKEN is not set")
        
        if not self.telegram_admin_ids:
            errors.append("TELEGRAM_ADMIN_IDS is not set")
        
        if errors:
            for error in errors:
                logger.error(f"Configuration error: {error}")
            return False
        
        return True
    
    def __repr__(self):
        return f"<Config(bot={self.bot_name}, version={self.bot_version})>"


# Global configuration instance with thread-safe access
_config = None
_config_lock = threading.Lock()


def get_config(config_path: Optional[str] = None, env_path: Optional[str] = None) -> Config:
    """
    Get or create global configuration instance (thread-safe)
    
    Note: Once initialized, the configuration is immutable. For testing or
    reconfiguration, use reset_config() first.
    """
    global _config
    
    # Double-checked locking pattern for thread safety
    if _config is None:
        with _config_lock:
            if _config is None:
                _config = Config(config_path, env_path)
    
    return _config


def reset_config():
    """
    Reset the global configuration instance
    
    This is primarily for testing purposes or when configuration needs to be reloaded.
    """
    global _config
    with _config_lock:
        _config = None
