"""
WhatsApp bot integration for AnomChatBot
Production-ready WhatsApp Web integration using webwhatsapi
WhatsApp bot integration for AnomChatBot using webwhatsapi
This implementation uses Selenium to automate WhatsApp Web.

Note: For production environments with high reliability requirements,
consider using Node.js-based solutions like Baileys or the official
WhatsApp Business API.
"""
import asyncio
import os
import time
import threading
from pathlib import Path
from typing import Optional, Dict, List
from datetime import datetime
from collections import deque
from loguru import logger

try:
    from webwhatsapi import WhatsAPIDriver
    from webwhatsapi.objects.message import Message
    from selenium.webdriver.chrome.options import Options as ChromeOptions
    from selenium.common.exceptions import WebDriverException
except ImportError:
    logger.warning(
        "webwhatsapi not installed. Install with: pip install webwhatsapi selenium webdriver-manager"
    )
    WhatsAPIDriver = None

from src.config import Config
from src.database import DatabaseManager
from src.conversation.conversation_manager import ConversationManager

# Import the full implementation
try:
    from src.whatsapp.whatsapp_bot_impl import WhatsAppBotImplementation
    USE_IMPLEMENTATION = True
except ImportError:
    USE_IMPLEMENTATION = False
    logger.warning("WhatsAppBotImplementation not available, using fallback")


class WhatsAppBot:
    """
    WhatsApp bot integration - delegates to full implementation
    WhatsApp bot integration using webwhatsapi
    
    Features:
    - QR code authentication with session persistence
    - Real-time message listening
    - Text, image, audio, and video message handling
    - Media download and processing
    - Auto-reconnection on disconnect
    - Integration with ConversationManager
    """
    
    def __init__(
        self,
        config: Config,
        db_manager: DatabaseManager,
        conversation_manager: ConversationManager
    ):
        if USE_IMPLEMENTATION:
            # Use full implementation
            self._impl = WhatsAppBotImplementation(config, db_manager, conversation_manager)
        else:
            # Fallback to skeleton
            self.config = config
            self.db = db_manager
            self.conversation_manager = conversation_manager
            self.is_running = False
            self.client = None
            self.session_path = config.whatsapp_session_path
            self._impl = None
    
    async def initialize(self):
        """Initialize WhatsApp client"""
        if self._impl:
            return await self._impl.initialize()
        
        # Fallback implementation
        try:
            os.makedirs(self.session_path, exist_ok=True)
            logger.info("WhatsApp client initialized (skeleton mode)")
        self.config = config
        self.db = db_manager
        self.conversation_manager = conversation_manager
        
        self.is_running = False
        self.is_authenticated = False
        self.client: Optional[WhatsAPIDriver] = None
        self.session_path = config.whatsapp_session_path
        self.listener_thread = None
        # Use deque for automatic size limiting of processed message IDs
        self.last_message_ids = deque(maxlen=1000)
        
        # Media directories
        self.media_base_path = Path("./data/media")
        self.image_path = self.media_base_path / "images"
        self.audio_path = self.media_base_path / "audio"
        self.video_path = self.media_base_path / "video"
        self.document_path = self.media_base_path / "documents"
        self._listener_task = None  # Store task reference
    
    async def initialize(self):
        """Initialize WhatsApp client with Selenium"""
        try:
            if WhatsAPIDriver is None:
                raise ImportError(
                    "webwhatsapi is not installed. Install with: "
                    "pip install webwhatsapi selenium webdriver-manager"
                )
            
            # Create necessary directories
            os.makedirs(self.session_path, exist_ok=True)
            os.makedirs(self.image_path, exist_ok=True)
            os.makedirs(self.audio_path, exist_ok=True)
            os.makedirs(self.video_path, exist_ok=True)
            os.makedirs(self.document_path, exist_ok=True)
            
            # Set up Chrome options for headless mode
            chrome_options = ChromeOptions()
            chrome_options.add_argument("--headless")  # Headless mode for background operation
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
            
            # Initialize WhatsApp driver with profile directory for session persistence
            profile_dir = os.path.abspath(self.session_path)
            logger.info(f"Initializing WhatsApp client with profile: {profile_dir}")
            
            try:
                self.client = WhatsAPIDriver(
                    profile=profile_dir,
                    client='chrome',
                    chrome_options=chrome_options,
                    headless=True
                )
                logger.info("WhatsApp client initialized successfully")
                
            except WebDriverException as e:
                logger.error(f"WebDriver error during initialization: {e}")
                logger.info("Trying with non-headless mode for QR code scanning...")
                
                # Try without headless for initial setup
                chrome_options_visible = ChromeOptions()
                chrome_options_visible.add_argument("--no-sandbox")
                chrome_options_visible.add_argument("--disable-dev-shm-usage")
                
                self.client = WhatsAPIDriver(
                    profile=profile_dir,
                    client='chrome',
                    chrome_options=chrome_options_visible,
                    headless=False
                )
                logger.info("WhatsApp client initialized in visible mode")
            
        except Exception as e:
            logger.error(f"Failed to initialize WhatsApp client: {e}")
            raise
    
    async def start(self):
        """Start WhatsApp bot"""
        if self._impl:
            return await self._impl.start()
        
        # Fallback implementation
        try:
            self.is_running = True
            await self.db.update_bot_status(whatsapp_connected=True)
            logger.info("WhatsApp bot started (skeleton mode)")
            logger.warning(
                "NOTE: This is a skeleton implementation. "
                "Install webwhatsapi for full functionality."
            )
            asyncio.create_task(self._message_listener())
        """Start WhatsApp bot and authenticate"""
        try:
            if self.client is None:
                raise RuntimeError("WhatsApp client not initialized. Call initialize() first.")
            
            logger.info("Starting WhatsApp bot...")
            
            # Check if already authenticated
            if self.client.is_logged_in():
                logger.info("Already authenticated with saved session")
                self.is_authenticated = True
                await self._on_ready()
            else:
                logger.info("Not authenticated. Waiting for QR code scan...")
                logger.info("Please scan the QR code with your WhatsApp mobile app")
                
                # Wait for QR code to be scanned
                qr_displayed = False
                max_wait = 120  # 2 minutes timeout
                wait_time = 0
                
                while not self.client.is_logged_in() and wait_time < max_wait:
                    try:
                        # Try to get QR code
                        if not qr_displayed:
                            qr_code = self.client.get_qr()
                            if qr_code:
                                # Save QR code to file
                                qr_path = os.path.join(self.session_path, "qr_code.png")
                                with open(qr_path, "wb") as f:
                                    f.write(qr_code)
                                logger.info(f"QR code saved to: {qr_path}")
                                logger.info("Scan the QR code with WhatsApp on your phone")
                                qr_displayed = True
                    except Exception as e:
                        logger.debug(f"Waiting for QR code... {e}")
                    
                    await asyncio.sleep(2)
                    wait_time += 2
                
                if self.client.is_logged_in():
                    logger.success("Successfully authenticated!")
                    self.is_authenticated = True
                    await self._on_ready()
                else:
                    raise TimeoutError("Authentication timeout. QR code was not scanned in time.")
            
            # Update bot status
            await self.db.update_bot_status(whatsapp_connected=True)
            
            # Start message listener
            self.is_running = True
            logger.info("WhatsApp bot started successfully")
            
            # Start listener in background
            asyncio.create_task(self._message_listener())
            # Start message listener (simulated) and store task reference
            self._listener_task = asyncio.create_task(self._message_listener())
            
        except Exception as e:
            logger.error(f"Failed to start WhatsApp bot: {e}")
            raise
    
    async def _on_ready(self):
        """Called when WhatsApp connection is ready"""
        try:
            logger.info("WhatsApp Web connection established")
            logger.info("Bot is now listening for messages...")
            
            # Get initial unread messages
            unread = self.client.get_unread()
            logger.info(f"Found {len(unread)} unread conversations")
            
        except Exception as e:
            logger.error(f"Error in on_ready handler: {e}")
    
    async def stop(self):
        """Stop WhatsApp bot"""
        if self._impl:
            return await self._impl.stop()
        
        # Fallback implementation
        try:
            logger.info("Stopping WhatsApp bot...")
            self.is_running = False
            
            # Give listener time to stop
            await asyncio.sleep(2)
            
            # Quit the driver
            if self.client:
                try:
                    self.client.quit()
                    logger.info("WebDriver closed")
                except Exception as e:
                    logger.warning(f"Error closing WebDriver: {e}")
            # Cancel the listener task if it's running
            if self._listener_task and not self._listener_task.done():
                self._listener_task.cancel()
                try:
                    await self._listener_task
                except asyncio.CancelledError:
                    pass
            
            # In real implementation:
            # Disconnect from WhatsApp Web
            
            # Update bot status
            await self.db.update_bot_status(whatsapp_connected=False)
            logger.info("WhatsApp bot stopped")
        except Exception as e:
            logger.error(f"Error stopping WhatsApp bot: {e}")
    
    async def _message_listener(self):
        """Listen for incoming messages (simulation)"""
        while self.is_running:
            try:
                await asyncio.sleep(1)
        """
        Listen for incoming messages in real-time
        Polls for new messages and processes them
        """
        logger.info("Message listener started")
        poll_interval = 2  # seconds
        
        while self.is_running:
            try:
                if not self.client or not self.is_authenticated:
                    logger.warning("Client not authenticated, waiting...")
                    await asyncio.sleep(poll_interval)
                    continue
                
                # Check if still logged in
                if not self.client.is_logged_in():
                    logger.error("Lost WhatsApp Web connection!")
                    await self._on_disconnected()
                    break
                
                # Get all unread messages
                try:
                    unread_messages = self.client.get_unread()
                    
                    for chat in unread_messages:
                        # Process each unread message
                        for message in chat.messages:
                            # Skip if we've already processed this message
                            message_id = message.id
                            if message_id in self.last_message_ids:
                                continue
                            
                            # Add to processed deque
                            self.last_message_ids.append(message_id)
                            
                            # Only process messages from individual chats (not groups)
                            if chat.chat_id.endswith("@g.us"):
                                logger.debug(f"Skipping group message from {chat.chat_id}")
                                continue
                            
                            # Process the message
                            await self._process_message(chat, message)
                
                except Exception as e:
                    logger.error(f"Error fetching messages: {e}")
                
                await asyncio.sleep(poll_interval)
                
            except Exception as e:
                logger.error(f"Error in message listener: {e}")
                await asyncio.sleep(5)
        
        logger.info("Message listener stopped")
    
    async def _process_message(self, chat, message: Message):
        """Process a single incoming message"""
        try:
            chat_id = chat.chat_id
            
            # Get contact info
            contact = self.client.get_contact_from_id(chat_id)
            contact_name = getattr(contact, 'name', None) or getattr(contact, 'push_name', 'Unknown')
            contact_number = chat_id.split('@')[0]
            
            logger.info(f"Processing message from {contact_name} ({contact_number})")
            
            # Determine message type and content
            message_type = message.type
            message_text = None
            media_path = None
            
            if message_type == "chat":
                # Text message
                message_text = message.content
                message_type = "text"
                
            elif message_type == "image":
                # Image message
                message_text = message.caption or "[Image]"
                media_path = await self.download_media(message.id, "image", message)
                message_type = "image"
                
            elif message_type == "video":
                # Video message
                message_text = message.caption or "[Video]"
                media_path = await self.download_media(message.id, "video", message)
                message_type = "video"
                
            elif message_type == "audio" or message_type == "ptt":
                # Audio/Voice message
                message_text = "[Voice message]"
                media_path = await self.download_media(message.id, "audio", message)
                message_type = "audio"
                
            elif message_type == "document":
                # Document
                message_text = f"[Document: {getattr(message, 'filename', 'file')}]"
                media_path = await self.download_media(message.id, "document", message)
                message_type = "document"
                
            else:
                logger.warning(f"Unsupported message type: {message_type}")
                return
            
            # Handle the message through the conversation manager
            await self.handle_incoming_message(
                chat_id=chat_id,
                contact_name=contact_name,
                contact_number=contact_number,
                message_text=message_text,
                message_type=message_type,
                media_path=media_path
            )
            
        except Exception as e:
            logger.error(f"Error processing message: {e}")
    
    async def _on_disconnected(self):
        """Called when WhatsApp connection is lost"""
        try:
            logger.warning("WhatsApp connection lost")
            self.is_authenticated = False
            await self.db.update_bot_status(whatsapp_connected=False)
            
            # Attempt reconnection
            logger.info("Attempting to reconnect...")
            await asyncio.sleep(5)
            
            if self.is_running:
                try:
                    await self.start()
                except Exception as e:
                    logger.error(f"Reconnection failed: {e}")
                    
        except Exception as e:
            logger.error(f"Error in on_disconnected handler: {e}")
    
    async def handle_incoming_message(
        self,
        chat_id: str,
        contact_name: str,
        contact_number: str,
        message_text: Optional[str] = None,
        message_type: str = 'text',
        media_path: Optional[str] = None
    ):
        """Handle incoming WhatsApp message"""
        if self._impl:
            return await self._impl.handle_incoming_message(
                chat_id, contact_name, contact_number, 
                message_text, message_type, media_path
            )
        
        # Fallback implementation
        try:
            await self.conversation_manager.start_conversation(
                chat_id=chat_id,
                platform='whatsapp',
                contact_name=contact_name,
                contact_number=contact_number
            )
            
            pending_first = self.conversation_manager.get_pending_first_message(chat_id)
            if pending_first:
            # Check if we have a pending first message
            pending_first = await self.conversation_manager.get_pending_first_message(chat_id)
            if pending_first:
                # Store the user's incoming message first
                await self.db.add_message(
                    chat_id=chat_id,
                    role='user',
                    content=message_text or "",
                    message_type=message_type,
                    media_path=media_path
                )
                
                # Send the manually crafted first message
                await self.send_message(chat_id, pending_first)
                await self.db.mark_first_message_sent(chat_id)
                self.conversation_manager.clear_pending_first_message(chat_id)
                await self.conversation_manager.clear_pending_first_message(chat_id)
                
                logger.info(f"Sent first message to {chat_id}")
                return
            
            response = await self.conversation_manager.process_incoming_message(
                chat_id=chat_id,
                message_text=message_text,
                message_type=message_type,
                media_path=media_path
            )
            
            if response:
                await self.send_message(chat_id, response)
                logger.info(f"Sent response to {chat_id}")
            
        except Exception as e:
            logger.error(f"Error handling incoming message: {e}")
    
    async def send_message(
        self,
        chat_id: str,
        message: str,
        reply_to: Optional[str] = None
    ):
        """Send message to WhatsApp chat"""
        if self._impl:
            return await self._impl.send_message(chat_id, message, reply_to)
        
        # Fallback implementation
        try:
            logger.info(f"[SIMULATION] Sending message to {chat_id}: {message[:50]}...")
            if not self.client or not self.is_authenticated:
                logger.error("Cannot send message: not authenticated")
                return
            
            # Send message through WhatsApp Web
            logger.info(f"Sending message to {chat_id}: {message[:50]}...")
            
            # Get chat object
            chat = self.client.get_chat_from_id(chat_id)
            
            if chat:
                # Send the message
                chat.send_message(message)
                logger.info(f"Message sent successfully to {chat_id}")
            else:
                logger.error(f"Could not find chat: {chat_id}")
            
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            raise
    
    async def send_media(
        self,
        chat_id: str,
        media_path: str,
        caption: Optional[str] = None,
        media_type: str = 'image'
    ):
        """Send media file to WhatsApp chat"""
        if self._impl:
            return await self._impl.send_media(chat_id, media_path, caption, media_type)
        
        # Fallback implementation
        try:
            logger.info(f"[SIMULATION] Sending {media_type} to {chat_id}")
            if not self.client or not self.is_authenticated:
                logger.error("Cannot send media: not authenticated")
                return
            
            logger.info(f"Sending {media_type} to {chat_id}")
            
            # Get chat object
            chat = self.client.get_chat_from_id(chat_id)
            
            if chat:
                # Send media based on type
                if media_type == 'image':
                    chat.send_media(media_path, caption)
                elif media_type == 'video':
                    chat.send_media(media_path, caption)
                elif media_type == 'document':
                    chat.send_media(media_path, caption)
                else:
                    logger.warning(f"Unsupported media type: {media_type}")
                
                logger.info(f"Media sent successfully to {chat_id}")
            else:
                logger.error(f"Could not find chat: {chat_id}")
            
        except Exception as e:
            logger.error(f"Error sending media: {e}")
            raise
    
    def is_connected(self) -> bool:
        """Check if WhatsApp is connected"""
        if self._impl:
            return self._impl.is_connected()
        return self.is_running
    
    async def get_contact_info(self, contact_id: str) -> Dict:
        """Get contact information"""
        if self._impl:
            return await self._impl.get_contact_info(contact_id)
        
        return {
            'name': 'Unknown',
            'number': contact_id,
            'profile_pic': None
        }
    async def download_media(
        self,
        message_id: str,
        media_type: str,
        message: Optional[Message] = None
    ) -> Optional[str]:
        """
        Download media from WhatsApp message
        
        Args:
            message_id: WhatsApp message identifier
            media_type: Type of media to download
            message: Message object containing media
            
        Returns:
            Path to downloaded file or None
        """
        try:
            if not message:
                logger.error("No message object provided for media download")
                return None
            
            # Determine save path based on media type
            if media_type == "image":
                save_dir = self.image_path
                extension = ".jpg"
            elif media_type == "audio":
                save_dir = self.audio_path
                extension = ".ogg"
            elif media_type == "video":
                save_dir = self.video_path
                extension = ".mp4"
            elif media_type == "document":
                save_dir = self.document_path
                # Safely get extension from filename
                filename = getattr(message, 'filename', 'file.bin')
                if '.' in filename:
                    extension = '.' + filename.split('.')[-1]
                else:
                    extension = '.bin'  # Default extension if none found
            else:
                logger.warning(f"Unknown media type: {media_type}")
                return None
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{media_type}_{timestamp}_{message_id[:10]}{extension}"
            save_path = save_dir / filename
            
            logger.info(f"Downloading {media_type} from message {message_id}")
            
            # Download the media
            try:
                # Note: webwhatsapi's save_media sometimes only downloads thumbnails
                # This is a known limitation of the library
                message.save_media(str(save_path), force_download=True)
                
                # Verify the file was created
                if os.path.exists(save_path):
                    logger.info(f"Media downloaded successfully: {save_path}")
                    return str(save_path)
                else:
                    logger.error(f"Media file was not created: {save_path}")
                    return None
            except AttributeError:
                logger.error("Message object doesn't have save_media method")
                return None
            except Exception as e:
                logger.error(f"Failed to download media: {e}")
                return None
            
        except Exception as e:
            logger.error(f"Error downloading media: {e}")
            return None
    
    async def get_contact_info(self, contact_id: str) -> Dict:
        """
        Get contact information
        
        Args:
            contact_id: WhatsApp contact identifier
            
        Returns:
            Contact information dictionary
        """
        try:
            if not self.client or not self.is_authenticated:
                return {
                    'name': 'Unknown',
                    'number': contact_id,
                    'profile_pic': None
                }
            
            contact = self.client.get_contact_from_id(contact_id)
            
            if contact:
                return {
                    'name': getattr(contact, 'name', None) or getattr(contact, 'push_name', 'Unknown'),
                    'number': contact_id.split('@')[0],
                    'profile_pic': getattr(contact, 'profile_pic', None)
                }
            else:
                return {
                    'name': 'Unknown',
                    'number': contact_id,
                    'profile_pic': None
                }
            
        except Exception as e:
            logger.error(f"Error getting contact info: {e}")
            return {
                'name': 'Unknown',
                'number': contact_id,
                'profile_pic': None
            }
        # In real implementation:
        # contact = await self.client.get_contact(contact_id)
        # return {
        #     'name': contact.name,
        #     'number': contact.number,
        #     'profile_pic': contact.profile_pic_url
        # }
        
        return {
            'name': 'Unknown',
            'number': contact_id,
            'profile_pic': None
        }
    
    async def set_status(self, status: str):
        """
        Set WhatsApp status
        
        Args:
            status: Status text
        """
        try:
            if not self.client or not self.is_authenticated:
                logger.error("Cannot set status: not authenticated")
                return
            
            # Note: webwhatsapi doesn't support setting status directly
            logger.info(f"Status setting not supported in current implementation: {status}")
            
        except Exception as e:
            logger.error(f"Error setting status: {e}")
    
    def is_connected(self) -> bool:
        """Check if WhatsApp is connected"""
        try:
            if self.client and self.is_authenticated:
                return self.client.is_logged_in()
            return False
        except Exception:
            return False
    
    async def get_qr_code(self) -> Optional[str]:
        """
        Get QR code for authentication
        
        Returns:
            Path to QR code image file or None
        """
        try:
            if not self.client:
                logger.error("Client not initialized")
                return None
            
            # Try to get QR code
            qr_code = self.client.get_qr()
            if qr_code:
                # Save QR code to file
                qr_path = os.path.join(self.session_path, "qr_code.png")
                with open(qr_path, "wb") as f:
                    f.write(qr_code)
                logger.info(f"QR code saved to: {qr_path}")
                return qr_path
            else:
                logger.info("No QR code available (already authenticated)")
                return None
            
        except Exception as e:
            logger.error(f"Error getting QR code: {e}")
            return None


# Documentation for production deployment
"""
PRODUCTION DEPLOYMENT NOTES:

Current Implementation:
- Uses webwhatsapi (Selenium-based WhatsApp Web automation)
- Functional for small to medium scale deployments
- Requires Chrome/Chromium browser
- Session persistence via browser profile
- QR code authentication on first run

Limitations:
- webwhatsapi is not actively maintained
- Selenium-based approach can be fragile to WhatsApp Web UI changes
- Not recommended for high-volume production use
- May face WhatsApp anti-bot measures

Recommended Production Alternatives:

1. **Node.js Baileys + Python REST API Wrapper**
   Pros:
   - Most stable WhatsApp Web API
   - Active development and maintenance
   - Multi-device support
   - Full feature support
   
   Implementation:
   - Deploy Baileys as Node.js microservice
   - Expose REST API for Python integration
   - Use whatsapp-api-py Python client
   - Docker containerization recommended

2. **WhatsApp Business API (Official)**
   Pros:
   - Official Meta/WhatsApp solution
   - Most reliable and compliant
   - Suitable for business use
   - Best support and documentation
   
   Requirements:
   - Facebook Business Manager account
   - WhatsApp Business API access approval
   - Pricing based on conversation volume
   
   Libraries:
   - whatsapp-python (PyPI)
   - PyWa framework

3. **Third-Party API Services**
   Options:
   - Twilio WhatsApp API
   - MessageBird WhatsApp API
   - 360dialog WhatsApp API
   
   Pros:
   - Managed infrastructure
   - Reliable uptime
   - Support included
   
   Cons:
   - Monthly fees
   - Vendor lock-in

Migration Path:
1. Keep current implementation for testing/development
2. For production, deploy Baileys Node.js service
3. Update WhatsAppBot to use REST API instead of Selenium
4. Maintain same interface so ConversationManager integration stays unchanged

Example Baileys Setup:
```bash
# In separate Node.js service
npm install baileys
npm install express

# Expose endpoints:
# POST /send - Send message
# GET /qr - Get QR code
# WebSocket /messages - Real-time messages

# Python integration:
pip install whatsapp-api-py
# Or use aiohttp for custom REST client
```

Security Considerations:
- Always use HTTPS for API communication
- Implement authentication/authorization
- Rate limiting to prevent abuse
- Session encryption and secure storage
- Regular security audits
- Compliance with WhatsApp Terms of Service

For questions or migration help, see:
- Baileys: https://github.com/WhiskeySockets/Baileys
- PyWa: https://pywa.readthedocs.io/
- WhatsApp Business API: https://business.whatsapp.com/products/business-platform
"""
