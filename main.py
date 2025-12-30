"""
Main application entry point for AnomChatBot
"""
import asyncio
import signal
import sys
from pathlib import Path
from loguru import logger

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.config import get_config
from src.database import DatabaseManager
from src.openai.openai_manager import OpenAIManager
from src.conversation.conversation_manager import ConversationManager
from src.telegram.telegram_bot import TelegramBot
from src.whatsapp.whatsapp_bot import WhatsAppBot


class AnomChatBot:
    """Main application class for AnomChatBot"""
    
    def __init__(self):
        self.config = None
        self.db = None
        self.openai = None
        self.conversation_manager = None
        self.telegram_bot = None
        self.whatsapp_bot = None
        self.running = False
    
    async def initialize(self):
        """Initialize all components"""
        try:
            logger.info("Initializing AnomChatBot...")
            
            # Load configuration
            self.config = get_config()
            if not self.config.validate():
                raise RuntimeError("Configuration validation failed")
            
            logger.info(f"Configuration loaded: {self.config.bot_name} v{self.config.bot_version}")
            
            # Initialize database
            self.db = DatabaseManager(self.config.database_url)
            await self.db.init_db()
            logger.info("Database initialized")
            
            # Initialize OpenAI
            self.openai = OpenAIManager(
                api_key=self.config.openai_api_key,
                model=self.config.openai_model
            )
            logger.info("OpenAI manager initialized")
            
            # Initialize conversation manager
            self.conversation_manager = ConversationManager(
                db_manager=self.db,
                openai_manager=self.openai,
                config=self.config
            )
            logger.info("Conversation manager initialized")
            
            # Initialize WhatsApp bot
            self.whatsapp_bot = WhatsAppBot(
                config=self.config,
                db_manager=self.db,
                conversation_manager=self.conversation_manager
            )
            await self.whatsapp_bot.initialize()
            logger.info("WhatsApp bot initialized")
            
            # Initialize Telegram bot
            self.telegram_bot = TelegramBot(
                config=self.config,
                db_manager=self.db,
                conversation_manager=self.conversation_manager,
                whatsapp_bot=self.whatsapp_bot
            )
            await self.telegram_bot.initialize()
            logger.info("Telegram bot initialized")
            
            logger.success("All components initialized successfully!")
            
        except Exception as e:
            logger.error(f"Failed to initialize: {e}")
            raise
    
    async def start(self):
        """Start the bot"""
        try:
            logger.info("Starting AnomChatBot...")
            
            # Start Telegram bot (admin panel)
            await self.telegram_bot.start()
            logger.info("Telegram bot started")
            
            # WhatsApp bot will be started via Telegram /start command
            logger.info("WhatsApp bot ready (use /start in Telegram to activate)")
            
            # Update bot status
            await self.db.update_bot_status(
                is_running=True,
                telegram_connected=True
            )
            
            self.running = True
            logger.success("AnomChatBot is running!")
            logger.info("Send /help to Telegram bot for commands")
            
            # Keep running
            while self.running:
                await asyncio.sleep(1)
            
        except Exception as e:
            logger.error(f"Error starting bot: {e}")
            raise
    
    async def stop(self):
        """Stop the bot"""
        try:
            logger.info("Stopping AnomChatBot...")
            
            self.running = False
            
            # Stop WhatsApp bot
            if self.whatsapp_bot:
                await self.whatsapp_bot.stop()
            
            # Stop Telegram bot
            if self.telegram_bot:
                await self.telegram_bot.stop()
            
            # Update bot status
            if self.db:
                await self.db.update_bot_status(
                    is_running=False,
                    whatsapp_connected=False,
                    telegram_connected=False
                )
            
            logger.info("AnomChatBot stopped")
            
        except Exception as e:
            logger.error(f"Error stopping bot: {e}")
    
    async def run(self):
        """Run the bot with proper signal handling"""
        
        # Setup signal handlers
        def signal_handler(signum, frame):
            logger.info(f"Received signal {signum}")
            # Request shutdown by clearing the running flag.
            # The async context will handle cleanup in `finally: await self.stop()`.
            self.running = False
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            await self.initialize()
            await self.start()
        except KeyboardInterrupt:
            logger.info("Interrupted by user")
        except Exception as e:
            logger.error(f"Fatal error: {e}")
        finally:
            await self.stop()


async def main():
    """Main entry point"""
    # Configure logging
    logger.remove()
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
        level="INFO"
    )
    logger.add(
        "data/logs/anomchatbot.log",
        rotation="10 MB",
        retention="10 days",
        level="DEBUG"
    )
    
    logger.info("=" * 60)
    logger.info("AnomChatBot - AI-Powered Multi-Platform Chatbot")
    logger.info("=" * 60)
    
    # Create and run bot
    bot = AnomChatBot()
    await bot.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down...")
    except Exception as e:
        logger.error(f"Application error: {e}")
        sys.exit(1)
