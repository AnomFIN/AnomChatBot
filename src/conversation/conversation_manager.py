"""
Conversation manager for AnomChatBot
"""
import time
from typing import Optional, Dict, List
from datetime import datetime
from loguru import logger

from src.database import DatabaseManager
from src.openai.openai_manager import OpenAIManager
from src.config import Config


class ConversationManager:
    """Manages conversations and AI interactions"""
    
    def __init__(
        self,
        db_manager: DatabaseManager,
        openai_manager: OpenAIManager,
        config: Config
    ):
        self.db = db_manager
        self.ai = openai_manager
        self.config = config
        
        # Track pending first messages
        self.pending_first_messages: Dict[str, Dict] = {}
    
    async def start_conversation(
        self,
        chat_id: str,
        platform: str,
        contact_name: Optional[str] = None,
        contact_number: Optional[str] = None
    ) -> Dict:
        """
        Start a new conversation
        
        Returns:
            Conversation info with prompt to configure
        """
        # Get or create conversation
        conversation = await self.db.get_or_create_conversation(
            chat_id=chat_id,
            platform=platform,
            contact_name=contact_name,
            contact_number=contact_number
        )
        
        logger.info(f"Started conversation for {chat_id} on {platform}")
        
        return {
            'chat_id': chat_id,
            'platform': platform,
            'needs_first_message': not conversation.first_message_sent,
            'status': 'active'
        }
    
    async def configure_conversation(
        self,
        chat_id: str,
        system_prompt: Optional[str] = None,
        tone_level: Optional[float] = None,
        flirt_level: Optional[float] = None,
        temperature: Optional[float] = None,
        custom_settings: Optional[Dict] = None
    ):
        """
        Configure conversation settings
        
        Args:
            chat_id: Chat identifier
            system_prompt: Custom system prompt
            tone_level: Conversation tone (0.0 - 1.0)
            flirt_level: Flirt level (0.0 - 1.0)
            temperature: AI temperature setting
            custom_settings: Additional custom settings
        """
        # Validate tone_level and flirt_level
        if tone_level is not None and not 0.0 <= tone_level <= 1.0:
            raise ValueError("tone_level must be between 0.0 and 1.0")
        if flirt_level is not None and not 0.0 <= flirt_level <= 1.0:
            raise ValueError("flirt_level must be between 0.0 and 1.0")
        
        # Update conversation settings
        await self.db.update_conversation_settings(
            chat_id=chat_id,
            system_prompt=system_prompt,
            tone_level=tone_level,
            flirt_level=flirt_level,
            temperature=temperature,
            **(custom_settings or {})
        )
        
        logger.info(f"Configured conversation settings for {chat_id}")
    
    async def set_pending_first_message(
        self,
        chat_id: str,
        message: str,
        system_prompt: Optional[str] = None,
        tone_level: float = 0.5,
        flirt_level: float = 0.0
    ):
        """
        Set pending first message to be sent manually
        
        Args:
            chat_id: Chat identifier
            message: First message to send
            system_prompt: System prompt for this conversation
            tone_level: Tone level (0.0 - 1.0)
            flirt_level: Flirt level (0.0 - 1.0)
        """
        # Validate tone_level and flirt_level
        if not 0.0 <= tone_level <= 1.0:
            raise ValueError("tone_level must be between 0.0 and 1.0")
        if not 0.0 <= flirt_level <= 1.0:
            raise ValueError("flirt_level must be between 0.0 and 1.0")
        
        self.pending_first_messages[chat_id] = {
            'message': message,
            'system_prompt': system_prompt,
            'tone_level': tone_level,
            'flirt_level': flirt_level,
            'timestamp': datetime.utcnow()
        }
        
        # Configure conversation
        await self.configure_conversation(
            chat_id=chat_id,
            system_prompt=system_prompt,
            tone_level=tone_level,
            flirt_level=flirt_level
        )
        
        logger.info(f"Set pending first message for {chat_id}")
    
    def get_pending_first_message(self, chat_id: str) -> Optional[str]:
        """
        Get pending first message
        
        Returns:
            First message to send or None
        """
        pending = self.pending_first_messages.get(chat_id)
        if pending:
            return pending['message']
        return None
    
    def clear_pending_first_message(self, chat_id: str):
        """Clear pending first message after it's sent"""
        if chat_id in self.pending_first_messages:
            del self.pending_first_messages[chat_id]
    
    async def process_incoming_message(
        self,
        chat_id: str,
        message_text: Optional[str],
        message_type: str = 'text',
        media_path: Optional[str] = None
    ) -> Optional[str]:
        """
        Process incoming message and generate AI response
        
        Args:
            chat_id: Chat identifier
            message_text: Message text content
            message_type: Type of message (text, image, video, audio)
            media_path: Path to media file if applicable
            
        Returns:
            AI response text or None if error
        """
        start_time = time.time()
        
        try:
            # Get conversation
            conversation = await self.db.get_conversation(chat_id)
            if not conversation:
                logger.error(f"Conversation not found: {chat_id}")
                return None
            
            # Check if first message has been sent
            if not conversation.first_message_sent:
                logger.warning(f"First message not sent yet for {chat_id}")
                return None
            
            # Process media if present
            media_metadata = {}
            full_content = message_text or ""
            
            if media_path:
                media_info = await self._process_media(
                    media_path, 
                    message_type
                )
                media_metadata = media_info
                
                # Add media description to content
                if media_info.get('description'):
                    full_content = f"[Käyttäjä lähetti {message_type}] {media_info['description']}\n{full_content}"
            
            # Save user message
            await self.db.add_message(
                chat_id=chat_id,
                role='user',
                content=full_content,
                message_type=message_type,
                media_path=media_path,
                media_metadata=media_metadata
            )
            
            # Get conversation history
            history = await self.db.get_conversation_history(
                chat_id=chat_id,
                limit=self.config.max_conversation_history
            )
            
            # Format messages for AI
            messages = self._format_history_for_ai(history)
            
            # Generate system prompt
            system_prompt = self.config.get_system_prompt(
                tone_level=conversation.tone_level,
                flirt_level=conversation.flirt_level,
                custom_prompt=conversation.system_prompt
            )
            
            # Generate AI response
            response_text, token_count = await self.ai.generate_response(
                messages=messages,
                temperature=conversation.temperature or self.config.default_temperature,
                max_tokens=conversation.max_tokens or self.config.default_max_tokens,
                system_prompt=system_prompt
            )
            
            processing_time = time.time() - start_time
            
            # Save AI response
            await self.db.add_message(
                chat_id=chat_id,
                role='assistant',
                content=response_text,
                token_count=token_count,
                processing_time=processing_time
            )
            
            logger.info(f"Processed message for {chat_id} in {processing_time:.2f}s")
            
            return response_text
            
        except Exception as e:
            logger.error(f"Error processing message for {chat_id}: {e}")
            return None
    
    async def _process_media(
        self,
        media_path: str,
        media_type: str
    ) -> Dict:
        """
        Process media file and extract information
        
        Args:
            media_path: Path to media file
            media_type: Type of media (image, video, audio)
            
        Returns:
            Media metadata dictionary
        """
        metadata = {
            'path': media_path,
            'type': media_type,
            'processed_at': datetime.utcnow().isoformat()
        }
        
        try:
            if media_type == 'image' and self.config.enable_image_analysis:
                description = await self.ai.analyze_image(media_path)
                metadata['description'] = description
                
            elif media_type == 'audio' and self.config.enable_audio_transcription:
                transcription = await self.ai.transcribe_audio(media_path)
                metadata['transcription'] = transcription
                metadata['description'] = f"Ääniviesti: {transcription}"
                
            elif media_type == 'video' and self.config.enable_video_analysis:
                # For video, we could extract frames and analyze them
                # For now, just note it's a video
                metadata['description'] = "Video-viesti"
            
        except Exception as e:
            logger.error(f"Error processing media: {e}")
            metadata['error'] = str(e)
        
        return metadata
    
    def _format_history_for_ai(self, messages: List) -> List[Dict[str, str]]:
        """
        Format message history for OpenAI API
        
        Args:
            messages: List of message objects from database
            
        Returns:
            Formatted messages for API
        """
        formatted = []
        
        for msg in messages:
            # Skip system messages
            if msg.role == 'system':
                continue
            
            content = msg.content or ""
            formatted.append({
                "role": msg.role,
                "content": content
            })
        
        return formatted
    
    async def get_conversation_summary(self, chat_id: str) -> Dict:
        """
        Get conversation summary and statistics
        
        Args:
            chat_id: Chat identifier
            
        Returns:
            Conversation summary
        """
        conversation = await self.db.get_conversation(chat_id)
        if not conversation:
            return {'error': 'Conversation not found'}
        
        messages = await self.db.get_conversation_history(chat_id, limit=1000)
        
        return {
            'chat_id': chat_id,
            'platform': conversation.platform,
            'contact_name': conversation.contact_name,
            'is_active': conversation.is_active,
            'first_message_sent': conversation.first_message_sent,
            'total_messages': len(messages),
            'tone_level': conversation.tone_level,
            'flirt_level': conversation.flirt_level,
            'created_at': conversation.created_at.isoformat() if conversation.created_at else None,
            'last_message_at': conversation.last_message_at.isoformat() if conversation.last_message_at else None
        }
    
    async def deactivate_conversation(self, chat_id: str):
        """Deactivate a conversation"""
        await self.db.deactivate_conversation(chat_id)
        logger.info(f"Deactivated conversation: {chat_id}")
    
    async def get_active_conversations(self) -> List[Dict]:
        """Get all active conversations"""
        conversations = await self.db.get_active_conversations()
        
        return [
            {
                'chat_id': conv.chat_id,
                'platform': conv.platform,
                'contact_name': conv.contact_name,
                'last_message_at': conv.last_message_at.isoformat() if conv.last_message_at else None
            }
            for conv in conversations
        ]
