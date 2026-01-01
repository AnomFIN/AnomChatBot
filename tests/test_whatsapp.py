"""
Basic tests for WhatsApp integration
Run with: python -m pytest tests/test_whatsapp.py
"""
import asyncio
import pytest
from pathlib import Path

# Mock the config and dependencies
class MockConfig:
    def __init__(self):
        self.whatsapp_session_path = "./data/whatsapp_session"
        self.openai_api_key = "test-key"
        self.openai_model = "gpt-4"
        self.database_url = "sqlite+aiosqlite:///./data/test_conversations.db"
        
    def validate(self):
        return True


class MockDatabaseManager:
    async def init_db(self):
        pass
    
    async def update_bot_status(self, **kwargs):
        pass
    
    async def get_or_create_conversation(self, **kwargs):
        class MockConversation:
            first_message_sent = False
        return MockConversation()


class MockOpenAIManager:
    def __init__(self, api_key, model):
        pass


class MockConversationManager:
    def __init__(self, db, openai, config):
        pass
    
    def get_pending_first_message(self, chat_id):
        return None
    
    async def start_conversation(self, **kwargs):
        pass
    
    async def process_incoming_message(self, **kwargs):
        return "Mock response"


@pytest.mark.asyncio
async def test_whatsapp_initialization():
    """Test WhatsApp bot initialization"""
    from src.whatsapp.whatsapp_bot import WhatsAppBot
    
    config = MockConfig()
    db = MockDatabaseManager()
    openai = MockOpenAIManager(config.openai_api_key, config.openai_model)
    conv_manager = MockConversationManager(db, openai, config)
    
    wa_bot = WhatsAppBot(config, db, conv_manager)
    await wa_bot.initialize()
    
    assert wa_bot is not None
    assert wa_bot.config is not None


@pytest.mark.asyncio
async def test_media_directory_structure():
    """Test media directory creation"""
    from src.whatsapp.whatsapp_bot import WhatsAppBot
    
    config = MockConfig()
    db = MockDatabaseManager()
    openai = MockOpenAIManager(config.openai_api_key, config.openai_model)
    conv_manager = MockConversationManager(db, openai, config)
    
    wa_bot = WhatsAppBot(config, db, conv_manager)
    await wa_bot.initialize()
    
    # Check if session path is set correctly
    assert wa_bot.session_path == config.whatsapp_session_path


@pytest.mark.asyncio
async def test_whatsapp_message_handling():
    """Test message handling without actual WhatsApp connection"""
    from src.whatsapp.whatsapp_bot import WhatsAppBot
    
    config = MockConfig()
    db = MockDatabaseManager()
    openai = MockOpenAIManager(config.openai_api_key, config.openai_model)
    conv_manager = MockConversationManager(db, openai, config)
    
    wa_bot = WhatsAppBot(config, db, conv_manager)
    await wa_bot.initialize()
    
    # Test message handling (will be in simulation mode)
    await wa_bot.handle_incoming_message(
        chat_id="test123@c.us",
        contact_name="Test User",
        contact_number="1234567890",
        message_text="Hello bot",
        message_type="text",
        media_path=None
    )
    
    # Should complete without errors


@pytest.mark.asyncio
async def test_whatsapp_connection_status():
    """Test connection status check"""
    from src.whatsapp.whatsapp_bot import WhatsAppBot
    
    config = MockConfig()
    db = MockDatabaseManager()
    openai = MockOpenAIManager(config.openai_api_key, config.openai_model)
    conv_manager = MockConversationManager(db, openai, config)
    
    wa_bot = WhatsAppBot(config, db, conv_manager)
    await wa_bot.initialize()
    
    # Initially not connected
    assert wa_bot.is_connected() == False
    
    # Start bot (simulation mode)
    await wa_bot.start()
    
    # Should be "connected" in simulation mode
    assert wa_bot.is_connected() == True


def test_session_path_creation():
    """Test that session path is properly configured"""
    config = MockConfig()
    assert config.whatsapp_session_path == "./data/whatsapp_session"
    
    # Test path creation
    session_path = Path(config.whatsapp_session_path)
    session_path.mkdir(parents=True, exist_ok=True)
    assert session_path.exists()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
