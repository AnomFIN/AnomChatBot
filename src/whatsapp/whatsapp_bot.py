import asyncio
import os
import time
from collections import deque
from typing import Optional, Dict, List, Any
from datetime import datetime, timedelta

from loguru import logger

# Optional imports - fall back gracefully if not available
try:
    from webwhatsapi import WhatsAPIDriver
    from selenium.webdriver.chrome.options import Options
    from webdriver_manager.chrome import ChromeDriverManager
    WHATSAPP_AVAILABLE = True
except ImportError:
    WHATSAPP_AVAILABLE = False
    logger.warning("webwhatsapi not available. WhatsApp functionality will be limited.")

try:
    import qrcode
    from PIL import Image
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False


class WhatsAppBot:
    """WhatsApp Web automation bot using webwhatsapi and selenium"""
    
    def __init__(self, db_manager, conversation_manager, session_path: str = "./data/whatsapp_sessions"):
        self.db = db_manager
        self.conversation_manager = conversation_manager
        self.session_path = session_path
        self.client = None
        self.is_running = False
        self.is_authenticated = False
        
        # Rate limiting
        self.rate_limits = {}  # chat_id -> last_message_time
        self.rate_limit_seconds = 2  # Minimum seconds between messages per chat
        
        # Message tracking for deduplication
        self.last_message_ids = deque(maxlen=1000)
        
        # Create session directory
        os.makedirs(session_path, exist_ok=True)
        
        # Initialize implementation based on availability
        if WHATSAPP_AVAILABLE:
            self._init_real_implementation()
        else:
            self._init_fallback_implementation()
    
    def _init_real_implementation(self):
        """Initialize real WhatsApp Web implementation"""
        try:
            # Chrome options for WhatsApp Web
            chrome_options = Options()
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage") 
            chrome_options.add_argument("--disable-extensions")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--remote-debugging-port=9222")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            
            # Profile directory for session persistence
            profile_dir = os.path.join(self.session_path, "chrome_profile")
            chrome_options.add_argument(f"--user-data-dir={profile_dir}")
            
            # Initialize driver
            self.client = WhatsAPIDriver(
                profile=profile_dir,
                client="chrome",
                chrome_options=chrome_options
            )
            logger.info("WhatsApp Web driver initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize WhatsApp driver: {e}")
            self._init_fallback_implementation()
    
    def _init_fallback_implementation(self):
        """Initialize fallback implementation when webwhatsapi is not available"""
        logger.warning("Using fallback WhatsApp implementation (simulation mode)")
        self.client = None
    
    async def initialize(self):
        """Initialize WhatsApp bot"""
        try:
            logger.info("Initializing WhatsApp bot...")
            
            if self.client is None:
                logger.info("WhatsApp bot initialized in simulation mode")
                return True
            
            # Real implementation initialization
            logger.info("WhatsApp Web client ready")
            return True
            
        except Exception as e:
            logger.error(f"WhatsApp initialization error: {e}")
            return False
    
    async def start(self):
        """Start WhatsApp bot"""
        try:
            self.is_running = True
            await self.db.update_bot_status(whatsapp_connected=True)
            
            if self.client is None:
                logger.info("WhatsApp bot started (simulation mode)")
                logger.warning("Install webwhatsapi for full functionality")
                return
            
            # Real implementation start
            logger.info("Starting WhatsApp Web connection...")
            
            # Check authentication status
            if not self.client.is_logged_in():
                logger.info("Not authenticated. Please scan QR code with WhatsApp mobile app")
                await self._wait_for_login()
            else:
                logger.info("Already authenticated")
                self.is_authenticated = True
            
            # Start message listener
            asyncio.create_task(self._message_listener())
            logger.info("WhatsApp bot started successfully")
            
        except Exception as e:
            logger.error(f"Error starting WhatsApp bot: {e}")
            await self.db.update_bot_status(whatsapp_connected=False)
            raise
    
    async def _wait_for_login(self, timeout: int = 120):
        """Wait for QR code scan and login"""
        try:
            start_time = time.time()
            qr_displayed = False
            
            while not self.client.is_logged_in() and (time.time() - start_time) < timeout:
                try:
                    # Try to get and display QR code
                    if not qr_displayed:
                        qr_code = self.client.get_qr_png()
                        if qr_code:
                            qr_path = os.path.join(self.session_path, "qr_code.png")
                            with open(qr_path, "wb") as f:
                                f.write(qr_code)
                            logger.info(f"QR code saved to: {qr_path}")
                            logger.info("Scan the QR code with WhatsApp on your phone")
                            qr_displayed = True
                
                except Exception as e:
                    logger.debug(f"Waiting for QR code: {e}")
                
                await asyncio.sleep(2)
            
            if self.client.is_logged_in():
                logger.success("WhatsApp Web authentication successful!")
                self.is_authenticated = True
                return True
            else:
                logger.error("Authentication timeout. QR code was not scanned in time.")
                return False
                
        except Exception as e:
            logger.error(f"Error during login process: {e}")
            return False
    
    async def stop(self):
        """Stop WhatsApp bot"""
        try:
            logger.info("Stopping WhatsApp bot...")
            self.is_running = False
            
            if self.client:
                try:
                    self.client.quit()
                    logger.info("WhatsApp Web driver closed")
                except Exception as e:
                    logger.warning(f"Error closing driver: {e}")
            
            await self.db.update_bot_status(whatsapp_connected=False)
            logger.info("WhatsApp bot stopped")
            
        except Exception as e:
            logger.error(f"Error stopping WhatsApp bot: {e}")
    
    async def _message_listener(self):
        """Listen for incoming messages"""
        logger.info("WhatsApp message listener started")
        
        while self.is_running:
            try:
                if self.client is None:
                    # Simulation mode - just sleep
                    await asyncio.sleep(5)
                    continue
                
                if not self.is_authenticated or not self.client.is_logged_in():
                    logger.warning("Not authenticated, waiting...")
                    await asyncio.sleep(5)
                    continue
                
                # Get unread messages
                try:
                    unread = self.client.get_unread()
                    
                    for chat in unread:
                        # Skip group chats
                        if chat.chat_id.endswith("@g.us"):
                            continue
                        
                        for message in chat.messages:
                            if message.id not in self.last_message_ids:
                                self.last_message_ids.append(message.id)
                                await self._process_message(chat, message)
                
                except Exception as e:
                    logger.error(f"Error fetching messages: {e}")
                
                await asyncio.sleep(2)  # Poll interval
                
            except Exception as e:
                logger.error(f"Error in message listener: {e}")
                await asyncio.sleep(5)
        
        logger.info("WhatsApp message listener stopped")
    
    async def _process_message(self, chat, message):
        """Process incoming message"""
        try:
            chat_id = chat.chat_id
            contact_number = chat_id.split('@')[0]
            
            # Get contact info
            try:
                contact = self.client.get_contact_from_id(chat_id)
                contact_name = getattr(contact, 'name', contact_number)
            except:
                contact_name = contact_number
            
            logger.info(f"Processing message from {contact_name} ({contact_number})")
            
            # Rate limiting check
            if not self._check_rate_limit(chat_id):
                logger.info(f"Rate limiting active for {contact_number}")
                return
            
            # Determine message type and content
            message_text = None
            media_path = None
            
            if hasattr(message, 'type'):
                msg_type = message.type
                
                if msg_type == "chat":
                    message_text = message.content
                    msg_type = "text"
                elif msg_type in ["image", "video", "audio", "document"]:
                    message_text = getattr(message, 'caption', f'[{msg_type.title()}]')
                    media_path = await self._download_media(message, msg_type)
                else:
                    logger.warning(f"Unsupported message type: {msg_type}")
                    return
            else:
                message_text = str(message)
                msg_type = "text"
            
            # Process with conversation manager
            if message_text:
                await self.conversation_manager.handle_whatsapp_message(
                    user_id=contact_number,
                    username=contact_name,
                    message=message_text,
                    message_type=msg_type,
                    media_path=media_path
                )
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    def _check_rate_limit(self, chat_id: str) -> bool:
        """Check if we're rate limited for this chat"""
        now = time.time()
        last_time = self.rate_limits.get(chat_id, 0)
        
        if now - last_time >= self.rate_limit_seconds:
            self.rate_limits[chat_id] = now
            return True
        return False
    
    async def _download_media(self, message, media_type: str) -> Optional[str]:
        """Download media file from message"""
        try:
            if not hasattr(message, 'save_media'):
                return None
            
            # Create media directory
            media_dir = os.path.join(self.session_path, "media", media_type)
            os.makedirs(media_dir, exist_ok=True)
            
            # Generate filename
            timestamp = int(time.time())
            filename = f"{timestamp}_{message.id}.{self._get_media_extension(media_type)}"
            filepath = os.path.join(media_dir, filename)
            
            # Download media
            success = message.save_media(filepath)
            if success and os.path.exists(filepath):
                logger.info(f"Media downloaded: {filepath}")
                return filepath
            
        except Exception as e:
            logger.error(f"Error downloading media: {e}")
        
        return None
    
    def _get_media_extension(self, media_type: str) -> str:
        """Get file extension for media type"""
        extensions = {
            "image": "jpg",
            "video": "mp4", 
            "audio": "ogg",
            "document": "pdf"
        }
        return extensions.get(media_type, "bin")
    
    async def send_message(self, chat_id: str, message: str) -> bool:
        """Send text message to WhatsApp"""
        try:
            if self.client is None:
                logger.warning("WhatsApp client not available (simulation mode)")
                return False
            
            if not self.is_authenticated:
                logger.error("WhatsApp not authenticated")
                return False
            
            # Format chat ID for WhatsApp
            if not chat_id.endswith("@c.us"):
                chat_id = f"{chat_id}@c.us"
            
            # Send message
            result = self.client.send_message(chat_id, message)
            
            if result:
                logger.info(f"Message sent to {chat_id}")
                return True
            else:
                logger.error(f"Failed to send message to {chat_id}")
                return False
            
        except Exception as e:
            logger.error(f"Error sending WhatsApp message: {e}")
            return False
    
    async def send_media(self, chat_id: str, file_path: str, caption: str = "") -> bool:
        """Send media file to WhatsApp"""
        try:
            if self.client is None:
                logger.warning("WhatsApp client not available (simulation mode)")
                return False
            
            if not self.is_authenticated:
                logger.error("WhatsApp not authenticated")
                return False
            
            if not os.path.exists(file_path):
                logger.error(f"Media file not found: {file_path}")
                return False
            
            # Format chat ID
            if not chat_id.endswith("@c.us"):
                chat_id = f"{chat_id}@c.us"
            
            # Send media based on type
            if file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                result = self.client.send_image(chat_id, file_path, caption)
            elif file_path.lower().endswith(('.mp4', '.avi', '.mov')):
                result = self.client.send_video(chat_id, file_path, caption)
            elif file_path.lower().endswith(('.mp3', '.wav', '.ogg')):
                result = self.client.send_audio(chat_id, file_path)
            else:
                result = self.client.send_document(chat_id, file_path, caption)
            
            if result:
                logger.info(f"Media sent to {chat_id}")
                return True
            else:
                logger.error(f"Failed to send media to {chat_id}")
                return False
            
        except Exception as e:
            logger.error(f"Error sending WhatsApp media: {e}")
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get bot status"""
        return {
            "running": self.is_running,
            "authenticated": self.is_authenticated,
            "client_available": self.client is not None,
            "whatsapp_available": WHATSAPP_AVAILABLE,
            "session_path": self.session_path
        }
