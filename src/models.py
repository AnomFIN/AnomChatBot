"""
Database models for AnomChatBot
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Boolean, JSON, ForeignKey, func
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Conversation(Base):
    """Stores conversation metadata and settings"""
    __tablename__ = 'conversations'
    
    id = Column(Integer, primary_key=True)
    chat_id = Column(String(100), unique=True, nullable=False, index=True)
    platform = Column(String(20), nullable=False)  # 'whatsapp' or 'telegram'
    contact_name = Column(String(200))
    contact_number = Column(String(50))
    
    # Conversation settings
    is_active = Column(Boolean, default=True)
    first_message_sent = Column(Boolean, default=False)
    pending_first_message = Column(Text)  # Persisted pending first message
    system_prompt = Column(Text)
    tone_level = Column(Float, default=0.5)  # 0.0 - 1.0
    flirt_level = Column(Float, default=0.0)  # 0.0 - 1.0
    temperature = Column(Float, default=0.7)
    max_tokens = Column(Integer, default=2000)
    
    # Additional settings as JSON
    settings = Column(JSON, default={})
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    last_message_at = Column(DateTime)
    
    # Relationships
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Conversation(chat_id='{self.chat_id}', platform='{self.platform}')>"


class Message(Base):
    """Stores individual messages in conversations"""
    __tablename__ = 'messages'
    
    id = Column(Integer, primary_key=True)
    conversation_id = Column(Integer, ForeignKey('conversations.id'), nullable=False)
    
    # Message content
    role = Column(String(20), nullable=False)  # 'user', 'assistant', 'system'
    content = Column(Text)
    message_type = Column(String(20), default='text')  # 'text', 'image', 'video', 'audio'
    
    # Media information
    media_path = Column(String(500))
    media_metadata = Column(JSON)  # For storing image analysis, transcription, etc.
    
    # Message metadata
    token_count = Column(Integer, default=0)
    processing_time = Column(Float)  # in seconds
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    
    def __repr__(self):
        return f"<Message(role='{self.role}', type='{self.message_type}')>"


class BotStatus(Base):
    """Stores bot status and statistics"""
    __tablename__ = 'bot_status'
    
    id = Column(Integer, primary_key=True)
    
    # Status information
    is_running = Column(Boolean, default=False)
    whatsapp_connected = Column(Boolean, default=False)
    telegram_connected = Column(Boolean, default=False)
    
    # Statistics
    total_conversations = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    active_conversations = Column(Integer, default=0)
    
    # System info
    cpu_usage = Column(Float)
    memory_usage = Column(Float)
    
    # Timestamps
    started_at = Column(DateTime)
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    def __repr__(self):
        return f"<BotStatus(running={self.is_running})>"


class AdminLog(Base):
    """Stores admin actions and system logs"""
    __tablename__ = 'admin_logs'
    
    id = Column(Integer, primary_key=True)
    
    # Admin info
    admin_id = Column(String(50), nullable=False)
    admin_username = Column(String(100))
    
    # Action details
    action = Column(String(50), nullable=False)
    description = Column(Text)
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    
    # Additional data
    metadata = Column(JSON)
    
    # Timestamp
    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    
    def __repr__(self):
        return f"<AdminLog(action='{self.action}', admin='{self.admin_username}')>"
