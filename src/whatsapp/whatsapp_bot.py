"""
WhatsApp bot integration for AnomChatBot
Production-ready WhatsApp Web integration using webwhatsapi
"""
import asyncio
import os
from typing import Optional, Dict
from loguru import logger

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
        except Exception as e:
            logger.error(f"Failed to start WhatsApp bot: {e}")
            raise
    
    async def stop(self):
        """Stop WhatsApp bot"""
        if self._impl:
            return await self._impl.stop()
        
        # Fallback implementation
        try:
            self.is_running = False
            await self.db.update_bot_status(whatsapp_connected=False)
            logger.info("WhatsApp bot stopped")
        except Exception as e:
            logger.error(f"Error stopping WhatsApp bot: {e}")
    
    async def _message_listener(self):
        """Listen for incoming messages (simulation)"""
        while self.is_running:
            try:
                await asyncio.sleep(1)
            except Exception as e:
                logger.error(f"Error in message listener: {e}")
                await asyncio.sleep(5)
    
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
                await self.send_message(chat_id, pending_first)
                await self.db.mark_first_message_sent(chat_id)
                self.conversation_manager.clear_pending_first_message(chat_id)
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
