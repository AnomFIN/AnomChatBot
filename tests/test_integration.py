"""
Unit tests for AnomChatBot
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Test the configuration
def test_config_validation():
    """Test configuration validation"""
    import os
    from src.config import Config
    
    # Test with missing required values
    config = Config()
    assert not config.validate()  # Should fail validation
    
    # Test with required values set
    os.environ['OPENAI_API_KEY'] = 'sk-test123'
    os.environ['TELEGRAM_BOT_TOKEN'] = '123456:ABC-DEF'
    os.environ['TELEGRAM_ADMIN_IDS'] = '123456789'
    
    config = Config()
    assert config.validate()  # Should pass validation
    
    # Clean up
    del os.environ['OPENAI_API_KEY']
    del os.environ['TELEGRAM_BOT_TOKEN'] 
    del os.environ['TELEGRAM_ADMIN_IDS']


@pytest.mark.asyncio
async def test_database_operations():
    """Test database operations"""
    from src.database import DatabaseManager
    from src.models import Conversation, Message
    
    # Use in-memory SQLite for testing
    db = DatabaseManager("sqlite+aiosqlite:///:memory:")
    await db.init_db()
    
    # Test conversation creation
    conversation = await db.get_or_create_conversation(
        chat_id="test_chat",
        platform="whatsapp",
        contact_name="Test User"
    )
    
    assert conversation.chat_id == "test_chat"
    assert conversation.platform == "whatsapp"
    assert conversation.contact_name == "Test User"
    
    # Test message adding
    message = await db.add_message(
        chat_id="test_chat",
        role="user",
        content="Test message",
        message_type="text"
    )
    
    assert message.content == "Test message"
    assert message.role == "user"
    
    # Test history retrieval
    history = await db.get_conversation_history("test_chat")
    assert len(history) == 1
    assert history[0].content == "Test message"


@pytest.mark.asyncio
async def test_openai_manager():
    """Test OpenAI manager"""
    from src.openai.openai_manager import OpenAIManager
    
    # Mock the API calls
    with patch('openai.AsyncOpenAI') as mock_openai:
        # Setup mock response
        mock_response = MagicMock()
        mock_response.choices[0].message.content = "Test response"
        mock_response.usage.total_tokens = 50
        
        mock_client = AsyncMock()
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client
        
        # Test OpenAI manager
        manager = OpenAIManager(api_key="test_key")
        
        messages = [{"role": "user", "content": "Hello"}]
        response, tokens = await manager.generate_response(messages)
        
        assert response == "Test response"
        assert tokens == 50


@pytest.mark.asyncio 
async def test_conversation_manager():
    """Test conversation manager"""
    from src.conversation.conversation_manager import ConversationManager
    from src.database import DatabaseManager
    from src.openai.openai_manager import OpenAIManager
    from src.config import Config
    
    # Setup mocks
    db = DatabaseManager("sqlite+aiosqlite:///:memory:")
    await db.init_db()
    
    with patch('openai.AsyncOpenAI'):
        config = Config()
        config.openai_api_key = "test_key"
        
        openai_manager = OpenAIManager("test_key")
        conv_manager = ConversationManager(db, openai_manager, config)
        
        # Test conversation start
        result = await conv_manager.start_conversation(
            chat_id="test_chat",
            platform="whatsapp",
            contact_name="Test User"
        )
        
        assert result['chat_id'] == "test_chat"
        assert result['platform'] == "whatsapp"
        assert result['status'] == "active"


def test_install_script():
    """Test install script components"""
    from install import AnomChatBotInstaller
    
    installer = AnomChatBotInstaller()
    
    # Test validation methods
    assert installer.validate_python_version()  # Should pass on this system
    
    # Test directory creation (with temp dir)
    with tempfile.TemporaryDirectory() as temp_dir:
        installer.project_dir = Path(temp_dir)
        assert installer.create_directories()
        
        # Check if directories were created
        expected_dirs = [
            "data/conversations",
            "data/media/images", 
            "data/media/audio",
            "data/logs"
        ]
        
        for dir_path in expected_dirs:
            assert (Path(temp_dir) / dir_path).exists()


@pytest.mark.asyncio
async def test_whatsapp_bot():
    """Test WhatsApp bot (simulation mode)"""
    from src.whatsapp.whatsapp_bot import WhatsAppBot
    from src.database import DatabaseManager
    from src.conversation.conversation_manager import ConversationManager
    from src.openai.openai_manager import OpenAIManager
    from src.config import Config
    
    # Setup with mocks
    db = DatabaseManager("sqlite+aiosqlite:///:memory:")
    await db.init_db()
    
    with patch('openai.AsyncOpenAI'):
        config = Config()
        config.whatsapp_session_path = "./test_session"
        
        openai_manager = OpenAIManager("test_key")
        conv_manager = ConversationManager(db, openai_manager, config)
        whatsapp_bot = WhatsAppBot(config, db, conv_manager)
        
        # Test initialization
        await whatsapp_bot.initialize()
        
        # Test start (should work in simulation mode)
        await whatsapp_bot.start()
        assert whatsapp_bot.is_running
        
        # Test stop
        await whatsapp_bot.stop()
        assert not whatsapp_bot.is_running


@pytest.mark.asyncio
async def test_telegram_bot():
    """Test Telegram bot"""
    from src.telegram.telegram_bot import TelegramBot
    from src.database import DatabaseManager
    from src.conversation.conversation_manager import ConversationManager
    from src.openai.openai_manager import OpenAIManager
    from src.config import Config
    
    # Setup with mocks
    db = DatabaseManager("sqlite+aiosqlite:///:memory:")
    await db.init_db()
    
    with patch('openai.AsyncOpenAI'), \
         patch('telegram.ext.Application.builder') as mock_builder:
        
        # Mock Telegram application
        mock_app = AsyncMock()
        mock_builder.return_value.token.return_value.build.return_value = mock_app
        
        config = Config()
        config.telegram_bot_token = "test_token"
        config.telegram_admin_ids = [123456]
        
        openai_manager = OpenAIManager("test_key")
        conv_manager = ConversationManager(db, openai_manager, config)
        
        telegram_bot = TelegramBot(config, db, conv_manager)
        
        # Test initialization
        await telegram_bot.initialize()
        assert telegram_bot.application is not None


def test_systemd_service():
    """Test systemd service creation"""
    from install import AnomChatBotInstaller
    
    with tempfile.TemporaryDirectory() as temp_dir:
        installer = AnomChatBotInstaller()
        installer.project_dir = Path(temp_dir)
        installer.is_linux = True
        
        # Test service creation
        success = installer.create_systemd_service()
        assert success
        
        # Check if service file was created
        service_file = Path(temp_dir) / 'systemd' / 'anomchatbot.service'
        assert service_file.exists()
        
        # Check service file contents
        content = service_file.read_text()
        assert 'AnomChatBot' in content
        assert 'main.py' in content


if __name__ == "__main__":
    # Run tests manually if needed
    import sys
    print("Running basic tests...")
    
    try:
        test_config_validation()
        print("✓ Config validation test passed")
        
        # Run async tests
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        loop.run_until_complete(test_database_operations())
        print("✓ Database operations test passed")
        
        loop.run_until_complete(test_openai_manager())
        print("✓ OpenAI manager test passed")
        
        loop.run_until_complete(test_conversation_manager())
        print("✓ Conversation manager test passed")
        
        test_install_script()
        print("✓ Install script test passed")
        
        loop.run_until_complete(test_whatsapp_bot())
        print("✓ WhatsApp bot test passed")
        
        loop.run_until_complete(test_telegram_bot())
        print("✓ Telegram bot test passed")
        
        test_systemd_service()
        print("✓ Systemd service test passed")
        
        loop.close()
        
        print("\nAll tests passed! ✅")
        
    except Exception as e:
        print(f"\nTest failed: ❌ {e}")
        sys.exit(1)