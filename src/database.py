"""
Database manager for AnomChatBot
"""
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, func, desc
from loguru import logger

from src.models import Base, Conversation, Message, BotStatus, AdminLog


class DatabaseManager:
    """Manages database connections and operations"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine = create_async_engine(database_url, echo=False)
        self.async_session = async_sessionmaker(
            self.engine, 
            class_=AsyncSession, 
            expire_on_commit=False
        )
    
    async def init_db(self):
        """Initialize database tables"""
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    async def get_session(self) -> AsyncSession:
        """Get a database session"""
        return self.async_session()
    
    # Conversation operations
    async def get_or_create_conversation(
        self, 
        chat_id: str, 
        platform: str,
        contact_name: Optional[str] = None,
        contact_number: Optional[str] = None
    ) -> Conversation:
        """Get existing conversation or create new one"""
        async with self.async_session() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.chat_id == chat_id)
            )
            conversation = result.scalar_one_or_none()
            
            if not conversation:
                conversation = Conversation(
                    chat_id=chat_id,
                    platform=platform,
                    contact_name=contact_name,
                    contact_number=contact_number
                )
                session.add(conversation)
                await session.commit()
                await session.refresh(conversation)
                logger.info(f"Created new conversation for chat_id: {chat_id}")
            
            return conversation
    
    async def update_conversation_settings(
        self,
        chat_id: str,
        system_prompt: Optional[str] = None,
        tone_level: Optional[float] = None,
        flirt_level: Optional[float] = None,
        temperature: Optional[float] = None,
        **kwargs
    ):
        """Update conversation settings"""
        async with self.async_session() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.chat_id == chat_id)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                if system_prompt is not None:
                    conversation.system_prompt = system_prompt
                if tone_level is not None:
                    conversation.tone_level = tone_level
                if flirt_level is not None:
                    conversation.flirt_level = flirt_level
                if temperature is not None:
                    conversation.temperature = temperature
                
                # Update additional settings
                if kwargs:
                    conversation.settings.update(kwargs)
                
                conversation.updated_at = datetime.utcnow()
                await session.commit()
                logger.info(f"Updated settings for conversation: {chat_id}")
    
    async def mark_first_message_sent(self, chat_id: str):
        """Mark that first message has been sent in conversation"""
        async with self.async_session() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.chat_id == chat_id)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                conversation.first_message_sent = True
                conversation.updated_at = datetime.utcnow()
                await session.commit()
    
    async def get_conversation(self, chat_id: str) -> Optional[Conversation]:
        """Get conversation by chat_id"""
        async with self.async_session() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.chat_id == chat_id)
            )
            return result.scalar_one_or_none()
    
    async def get_active_conversations(self) -> List[Conversation]:
        """Get all active conversations"""
        async with self.async_session() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.is_active == True)
            )
            return result.scalars().all()
    
    async def deactivate_conversation(self, chat_id: str):
        """Deactivate a conversation"""
        async with self.async_session() as session:
            result = await session.execute(
                select(Conversation).where(Conversation.chat_id == chat_id)
            )
            conversation = result.scalar_one_or_none()
            
            if conversation:
                conversation.is_active = False
                conversation.updated_at = datetime.utcnow()
                await session.commit()
    
    # Message operations
    async def add_message(
        self,
        chat_id: str,
        role: str,
        content: str,
        message_type: str = 'text',
        media_path: Optional[str] = None,
        media_metadata: Optional[Dict] = None,
        token_count: int = 0,
        processing_time: Optional[float] = None
    ) -> Message:
        """Add a message to conversation"""
        async with self.async_session() as session:
            # Get conversation
            result = await session.execute(
                select(Conversation).where(Conversation.chat_id == chat_id)
            )
            conversation = result.scalar_one_or_none()
            
            if not conversation:
                raise ValueError(f"Conversation not found: {chat_id}")
            
            # Create message
            message = Message(
                conversation_id=conversation.id,
                role=role,
                content=content,
                message_type=message_type,
                media_path=media_path,
                media_metadata=media_metadata or {},
                token_count=token_count,
                processing_time=processing_time
            )
            
            session.add(message)
            
            # Update conversation timestamp
            conversation.last_message_at = datetime.utcnow()
            conversation.updated_at = datetime.utcnow()
            
            await session.commit()
            await session.refresh(message)
            
            return message
    
    async def get_conversation_history(
        self, 
        chat_id: str, 
        limit: int = 50
    ) -> List[Message]:
        """Get recent messages from conversation"""
        async with self.async_session() as session:
            # Get conversation
            result = await session.execute(
                select(Conversation).where(Conversation.chat_id == chat_id)
            )
            conversation = result.scalar_one_or_none()
            
            if not conversation:
                return []
            
            # Get messages
            result = await session.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(desc(Message.created_at))
                .limit(limit)
            )
            messages = result.scalars().all()
            
            # Return in chronological order
            return list(reversed(messages))
    
    # Bot status operations
    async def update_bot_status(
        self,
        is_running: Optional[bool] = None,
        whatsapp_connected: Optional[bool] = None,
        telegram_connected: Optional[bool] = None,
        **kwargs
    ):
        """Update bot status"""
        async with self.async_session() as session:
            result = await session.execute(select(BotStatus))
            status = result.scalar_one_or_none()
            
            if not status:
                status = BotStatus()
                session.add(status)
            
            if is_running is not None:
                status.is_running = is_running
                if is_running and not status.started_at:
                    status.started_at = datetime.utcnow()
            
            if whatsapp_connected is not None:
                status.whatsapp_connected = whatsapp_connected
            
            if telegram_connected is not None:
                status.telegram_connected = telegram_connected
            
            # Update statistics if provided
            for key, value in kwargs.items():
                if hasattr(status, key):
                    setattr(status, key, value)
            
            status.updated_at = datetime.utcnow()
            await session.commit()
    
    async def get_bot_status(self) -> Optional[BotStatus]:
        """Get current bot status"""
        async with self.async_session() as session:
            result = await session.execute(select(BotStatus))
            return result.scalar_one_or_none()
    
    # Admin log operations
    async def add_admin_log(
        self,
        admin_id: str,
        action: str,
        description: Optional[str] = None,
        admin_username: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """Add admin action log"""
        async with self.async_session() as session:
            log = AdminLog(
                admin_id=admin_id,
                admin_username=admin_username,
                action=action,
                description=description,
                success=success,
                error_message=error_message,
                metadata=metadata or {}
            )
            session.add(log)
            await session.commit()
    
    async def get_admin_logs(self, limit: int = 100) -> List[AdminLog]:
        """Get recent admin logs"""
        async with self.async_session() as session:
            result = await session.execute(
                select(AdminLog)
                .order_by(desc(AdminLog.created_at))
                .limit(limit)
            )
            return result.scalars().all()
    
    # Statistics
    async def get_statistics(self) -> Dict:
        """Get bot statistics"""
        async with self.async_session() as session:
            # Count conversations
            total_convs = await session.execute(
                select(func.count(Conversation.id))
            )
            total_conversations = total_convs.scalar()
            
            # Count active conversations
            active_convs = await session.execute(
                select(func.count(Conversation.id))
                .where(Conversation.is_active == True)
            )
            active_conversations = active_convs.scalar()
            
            # Count messages
            total_msgs = await session.execute(
                select(func.count(Message.id))
            )
            total_messages = total_msgs.scalar()
            
            # Recent activity (last 24 hours)
            yesterday = datetime.utcnow() - timedelta(days=1)
            recent_msgs = await session.execute(
                select(func.count(Message.id))
                .where(Message.created_at >= yesterday)
            )
            messages_24h = recent_msgs.scalar()
            
            return {
                'total_conversations': total_conversations,
                'active_conversations': active_conversations,
                'total_messages': total_messages,
                'messages_last_24h': messages_24h
            }
