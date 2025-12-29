"""
WhatsApp bot implementation using webwhatsapi
Full production-ready WhatsApp Web integration
"""
import asyncio
import os
import time
from datetime import datetime
from typing import Optional, Dict
from pathlib import Path
import qrcode
from loguru import logger

try:
    from webwhatsapi import WhatsAPIDriver
    from webwhatsapi.objects.message import Message
    WEBWHATSAPI_AVAILABLE = True
except ImportError:
    WEBWHATSAPI_AVAILABLE = False
    logger.warning("webwhatsapi not installed - WhatsApp integration will use simulation mode")

from src.config import Config
from src.database import DatabaseManager
from src.conversation.conversation_manager import ConversationManager


class WhatsAppBotImplementation:
    """
    Full WhatsApp Web integration using webwhatsapi
    """
    
    def __init__(
        self,
        config: Config,
        db_manager: DatabaseManager,
        conversation_manager: ConversationManager
    ):
        self.config = config
        self.db = db_manager
        self.conversation_manager = conversation_manager
        
        self.is_running = False
        self.client = None
        self.session_path = Path(config.whatsapp_session_path)
        self.last_message_time = {}  # Rate limiting
        self.message_count = {}  # Rate limiting counter
        
    async def initialize(self):
        """Initialize WhatsApp client"""
        try:
            if not WEBWHATSAPI_AVAILABLE:
                logger.warning("WhatsApp integration running in simulation mode")
                return
            
            # Create session directory
            self.session_path.mkdir(parents=True, exist_ok=True)
            
            # Create media directories
            for media_type in ['image', 'audio', 'video', 'document']:
                media_dir = Path(f"data/media/{media_type}")
                media_dir.mkdir(parents=True, exist_ok=True)
            
            logger.info("WhatsApp client initialized")
            
        except Exception as e:
            logger.error(f"Failed to initialize WhatsApp client: {e}")
            raise
    
    async def start(self):
        """Start WhatsApp bot"""
        try:
            if not WEBWHATSAPI_AVAILABLE:
                logger.warning("WhatsApp running in simulation mode")
                self.is_running = True
                await self.db.update_bot_status(whatsapp_connected=True)
                return
            
            logger.info("Starting WhatsApp Web connection...")
            
            # Initialize driver with chrome
            profile_path = str(self.session_path / "chrome_profile")
            self.client = WhatsAPIDriver(
                profile=profile_path,
                client='chrome',
                loadstyles=True
            )
            
            # Wait for login
            logger.info("Waiting for WhatsApp Web login...")
            logger.info("If you need to scan QR code, it will be saved to data/qr_code.png")
            
            # Try to get QR code
            try:
                await self._handle_qr_code()
            except Exception as e:
                logger.warning(f"Could not save QR code: {e}")
            
            # Wait for login with timeout
            login_timeout = 120  # 2 minutes
            start_time = time.time()
            
            while not self.client.is_logged_in():
                if time.time() - start_time > login_timeout:
                    raise TimeoutError("WhatsApp login timeout - QR code not scanned")
                await asyncio.sleep(2)
                logger.info("Waiting for QR code scan...")
            
            logger.success("WhatsApp Web connected!")
            
            self.is_running = True
            await self.db.update_bot_status(whatsapp_connected=True)
            
            # Start message listener
            asyncio.create_task(self._message_listener())
            
        except Exception as e:
            logger.error(f"Failed to start WhatsApp bot: {e}")
            await self.db.update_bot_status(whatsapp_connected=False)
            raise
    
    async def stop(self):
        """Stop WhatsApp bot"""
        try:
            self.is_running = False
            
            if self.client and WEBWHATSAPI_AVAILABLE:
                try:
                    self.client.quit()
                except:
                    pass
            
            await self.db.update_bot_status(whatsapp_connected=False)
            logger.info("WhatsApp bot stopped")
            
        except Exception as e:
            logger.error(f"Error stopping WhatsApp bot: {e}")
    
    async def _handle_qr_code(self):
        """Handle QR code generation and saving"""
        try:
            if not self.client:
                return
            
            # Get QR code from client
            qr_data = self.client.get_qr()
            
            if qr_data:
                # Generate QR code image
                qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_L,
                    box_size=10,
                    border=4,
                )
                qr.add_data(qr_data)
                qr.make(fit=True)
                
                # Create image
                img = qr.make_image(fill_color="black", back_color="white")
                
                # Save to file
                qr_path = "data/qr_code.png"
                img.save(qr_path)
                
                logger.info(f"📱 QR code saved to {qr_path}")
                print(f"\n{'='*60}")
                print(f"📱 WhatsApp QR Code saved to: {qr_path}")
                print(f"{'='*60}\n")
                
        except Exception as e:
            logger.error(f"Error handling QR code: {e}")
    
    async def _message_listener(self):
        """Listen for incoming messages"""
        logger.info("WhatsApp message listener started")
        
        if not WEBWHATSAPI_AVAILABLE or not self.client:
            logger.warning("Message listener in simulation mode")
            while self.is_running:
                await asyncio.sleep(1)
            return
        
        while self.is_running:
            try:
                # Get unread messages
                unread = self.client.get_unread()
                
                for message_group in unread:
                    # Get chat
                    chat = message_group.chat
                    
                    # Skip groups - only handle individual chats
                    if chat.is_group:
                        logger.debug(f"Skipping group chat: {chat.name}")
                        continue
                    
                    # Process messages
                    for message in message_group.messages:
                        await self._process_message(chat, message)
                
                # Sleep to avoid excessive polling
                await asyncio.sleep(2)
                
            except Exception as e:
                logger.error(f"Error in message listener: {e}")
                await asyncio.sleep(5)
                
                # Try to reconnect if disconnected
                if not self.client.is_logged_in():
                    logger.warning("WhatsApp disconnected - attempting reconnect...")
                    await self.db.update_bot_status(whatsapp_connected=False)
                    try:
                        await self.start()
                    except Exception as reconnect_error:
                        logger.error(f"Reconnection failed: {reconnect_error}")
                        await asyncio.sleep(30)
    
    async def _process_message(self, chat, message: 'Message'):
        """Process a single message"""
        try:
            # Rate limiting check
            chat_id = chat.id
            if not self._check_rate_limit(chat_id):
                logger.warning(f"Rate limit exceeded for {chat_id}")
                return
            
            # Get message details
            message_text = message.content if hasattr(message, 'content') else str(message)
            message_type = message.type if hasattr(message, 'type') else 'text'
            
            # Get contact info
            contact_name = chat.name if hasattr(chat, 'name') else 'Unknown'
            contact_number = chat.id
            
            logger.info(f"Processing message from {contact_name} ({chat_id}): {message_type}")
            
            # Download media if present
            media_path = None
            if message_type in ['image', 'video', 'audio', 'document']:
                media_path = await self._download_message_media(message, message_type)
            
            # Handle incoming message
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
    
    def _check_rate_limit(self, chat_id: str) -> bool:
        """Check if we should respond (rate limiting)"""
        current_time = time.time()
        
        # Reset counter every hour
        if chat_id not in self.message_count or \
           current_time - self.last_message_time.get(chat_id, 0) > 3600:
            self.message_count[chat_id] = 0
            self.last_message_time[chat_id] = current_time
        
        # Max 20 messages per hour
        if self.message_count[chat_id] >= 20:
            return False
        
        # Minimum 2 seconds between messages
        if current_time - self.last_message_time.get(chat_id, 0) < 2:
            return False
        
        self.message_count[chat_id] += 1
        self.last_message_time[chat_id] = current_time
        return True
    
    async def _download_message_media(self, message: 'Message', media_type: str) -> Optional[str]:
        """Download media from message"""
        try:
            # Create media directory
            media_dir = Path(f"data/media/{media_type}")
            media_dir.mkdir(parents=True, exist_ok=True)
            
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            message_id = getattr(message, 'id', 'unknown')[:8]
            
            # Determine extension
            ext_map = {
                'image': '.jpg',
                'video': '.mp4',
                'audio': '.ogg',
                'document': '.pdf'
            }
            ext = ext_map.get(media_type, '.bin')
            
            filename = f"{media_type}_{timestamp}_{message_id}{ext}"
            save_path = media_dir / filename
            
            # Download media
            if hasattr(message, 'save_media'):
                message.save_media(str(save_path))
                logger.info(f"Downloaded {media_type} to {save_path}")
                return str(save_path)
            else:
                logger.warning(f"Message does not support media download")
                return None
                
        except Exception as e:
            logger.error(f"Error downloading media: {e}")
            return None
    
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
        try:
            # Start/get conversation
            await self.conversation_manager.start_conversation(
                chat_id=chat_id,
                platform='whatsapp',
                contact_name=contact_name,
                contact_number=contact_number
            )
            
            # Check for pending first message
            pending_first = self.conversation_manager.get_pending_first_message(chat_id)
            if pending_first:
                await self.send_message(chat_id, pending_first)
                await self.db.mark_first_message_sent(chat_id)
                self.conversation_manager.clear_pending_first_message(chat_id)
                logger.info(f"Sent first message to {chat_id}")
                return
            
            # Process message and get AI response
            response = await self.conversation_manager.process_incoming_message(
                chat_id=chat_id,
                message_text=message_text,
                message_type=message_type,
                media_path=media_path
            )
            
            if response:
                # Add delay to seem more natural
                await asyncio.sleep(2)
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
        try:
            if not WEBWHATSAPI_AVAILABLE or not self.client:
                logger.info(f"[SIMULATION] Sending to {chat_id}: {message[:50]}...")
                return
            
            # Get chat
            chat = self.client.get_chat_from_id(chat_id)
            if not chat:
                logger.error(f"Chat not found: {chat_id}")
                return
            
            # Send message
            chat.send_message(message)
            logger.info(f"Message sent to {chat_id}")
            
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
        try:
            if not WEBWHATSAPI_AVAILABLE or not self.client:
                logger.info(f"[SIMULATION] Sending {media_type} to {chat_id}")
                return
            
            # Get chat
            chat = self.client.get_chat_from_id(chat_id)
            if not chat:
                logger.error(f"Chat not found: {chat_id}")
                return
            
            # Send based on type
            if media_type == 'image':
                chat.send_media(media_path, caption)
            elif media_type == 'video':
                chat.send_media(media_path, caption)
            elif media_type == 'audio':
                chat.send_media(media_path, caption)
            else:
                chat.send_media(media_path, caption)
            
            logger.info(f"Media sent to {chat_id}")
            
        except Exception as e:
            logger.error(f"Error sending media: {e}")
            raise
    
    def is_connected(self) -> bool:
        """Check if WhatsApp is connected"""
        if not WEBWHATSAPI_AVAILABLE or not self.client:
            return self.is_running
        
        try:
            return self.is_running and self.client.is_logged_in()
        except:
            return False
    
    async def get_contact_info(self, contact_id: str) -> Dict:
        """Get contact information"""
        try:
            if not WEBWHATSAPI_AVAILABLE or not self.client:
                return {
                    'name': 'Unknown',
                    'number': contact_id,
                    'profile_pic': None
                }
            
            chat = self.client.get_chat_from_id(contact_id)
            if chat:
                return {
                    'name': getattr(chat, 'name', 'Unknown'),
                    'number': contact_id,
                    'profile_pic': None
                }
            
            return {
                'name': 'Unknown',
                'number': contact_id,
                'profile_pic': None
            }
            
        except Exception as e:
            logger.error(f"Error getting contact info: {e}")
            return {}
