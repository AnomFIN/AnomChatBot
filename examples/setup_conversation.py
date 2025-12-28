"""
Example script for setting up first messages and conversation configurations
Usage: python3 examples/setup_conversation.py
"""
import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.config import get_config
from src.database import DatabaseManager
from src.openai.openai_manager import OpenAIManager
from src.conversation.conversation_manager import ConversationManager


async def example_setup_professional_conversation():
    """Example: Set up a professional IT support conversation"""
    
    # Initialize components
    config = get_config()
    db = DatabaseManager(config.database_url)
    await db.init_db()
    
    openai_manager = OpenAIManager(
        api_key=config.openai_api_key,
        model=config.openai_model
    )
    
    conversation_manager = ConversationManager(db, openai_manager, config)
    
    # Example chat ID (WhatsApp format)
    chat_id = "1234567890@c.us"  # Replace with actual WhatsApp chat ID
    
    # Set up conversation with professional tone
    await conversation_manager.set_pending_first_message(
        chat_id=chat_id,
        message="Hei! Olen IT-tukibottisi. Voin auttaa sinua tietoteknisissä ongelmissa. Kerro, mikä ongelma sinulla on?",
        system_prompt="Olet ammattitaitoinen IT-tukihenkilö. Vastaat selkeästi ja teknisesti tarkasti. Kysyt tarvittaessa lisätietoja ja tarjoat ratkaisuja vaihe vaiheelta.",
        tone_level=0.0,  # Professional
        flirt_level=0.0  # None
    )
    
    print("✅ Professional IT support conversation configured")
    print(f"   Chat ID: {chat_id}")
    print(f"   First message ready to send")


async def example_setup_friendly_conversation():
    """Example: Set up a friendly casual conversation"""
    
    config = get_config()
    db = DatabaseManager(config.database_url)
    await db.init_db()
    
    openai_manager = OpenAIManager(
        api_key=config.openai_api_key,
        model=config.openai_model
    )
    
    conversation_manager = ConversationManager(db, openai_manager, config)
    
    chat_id = "9876543210@c.us"  # Replace with actual WhatsApp chat ID
    
    # Set up conversation with friendly casual tone
    await conversation_manager.set_pending_first_message(
        chat_id=chat_id,
        message="Moi! 😊 Kivaa nähdä! Mitä kuuluu?",
        system_prompt="Olet ystävällinen ja lämmin keskustelukumppani. Olet aidosti kiinnostunut toisesta ja kuuntelet tarkasti. Käytä emojeja sopivasti.",
        tone_level=0.5,  # Friendly
        flirt_level=0.0  # None
    )
    
    print("✅ Friendly casual conversation configured")
    print(f"   Chat ID: {chat_id}")


async def example_setup_playful_conversation():
    """Example: Set up a playful conversation with subtle flirting"""
    
    config = get_config()
    db = DatabaseManager(config.database_url)
    await db.init_db()
    
    openai_manager = OpenAIManager(
        api_key=config.openai_api_key,
        model=config.openai_model
    )
    
    conversation_manager = ConversationManager(db, openai_manager, config)
    
    chat_id = "5555555555@c.us"  # Replace with actual WhatsApp chat ID
    
    # Set up conversation with playful tone and subtle flirting
    await conversation_manager.set_pending_first_message(
        chat_id=chat_id,
        message="Hei sinä! 😊 Mukava tavata. Tiedät mikä on parasta tässä hetkessä? Että saan jutella sun kanssa! ☺️",
        system_prompt="Olet leikkisä ja humoristinen keskustelukumppani. Käytät sopivasti emojeja ja olet hieman flirtaileva. Pidät keskustelun kevyenä ja hauskana.",
        tone_level=1.0,  # Playful
        flirt_level=0.3  # Subtle
    )
    
    print("✅ Playful conversation with subtle flirting configured")
    print(f"   Chat ID: {chat_id}")


async def example_configure_existing_conversation():
    """Example: Update settings for an existing conversation"""
    
    config = get_config()
    db = DatabaseManager(config.database_url)
    await db.init_db()
    
    openai_manager = OpenAIManager(
        api_key=config.openai_api_key,
        model=config.openai_model
    )
    
    conversation_manager = ConversationManager(db, openai_manager, config)
    
    chat_id = "1234567890@c.us"  # Existing conversation
    
    # Update conversation settings
    await conversation_manager.configure_conversation(
        chat_id=chat_id,
        tone_level=0.8,  # Change to Casual
        flirt_level=0.0,
        temperature=0.8,  # More creative responses
        custom_settings={
            'use_emojis': True,
            'max_response_length': 200
        }
    )
    
    print("✅ Conversation settings updated")
    print(f"   Chat ID: {chat_id}")
    print(f"   New tone: Casual (0.8)")
    print(f"   Temperature: 0.8")


async def example_get_conversation_info():
    """Example: Get information about a conversation"""
    
    config = get_config()
    db = DatabaseManager(config.database_url)
    await db.init_db()
    
    openai_manager = OpenAIManager(
        api_key=config.openai_api_key,
        model=config.openai_model
    )
    
    conversation_manager = ConversationManager(db, openai_manager, config)
    
    chat_id = "1234567890@c.us"
    
    # Get conversation summary
    summary = await conversation_manager.get_conversation_summary(chat_id)
    
    print("📊 Conversation Summary:")
    print(f"   Chat ID: {summary.get('chat_id')}")
    print(f"   Platform: {summary.get('platform')}")
    print(f"   Contact: {summary.get('contact_name')}")
    print(f"   Active: {summary.get('is_active')}")
    print(f"   Total Messages: {summary.get('total_messages')}")
    print(f"   Tone Level: {summary.get('tone_level')}")
    print(f"   Flirt Level: {summary.get('flirt_level')}")


async def main():
    """Main function - run examples"""
    
    print("=" * 60)
    print("AnomChatBot - Conversation Setup Examples")
    print("=" * 60)
    print()
    
    try:
        # Choose which example to run
        print("Available examples:")
        print("1. Professional IT Support")
        print("2. Friendly Casual")
        print("3. Playful with Flirting")
        print("4. Update Existing Conversation")
        print("5. Get Conversation Info")
        print()
        
        choice = input("Choose example (1-5) or 'all': ").strip()
        
        if choice == "1" or choice == "all":
            await example_setup_professional_conversation()
            print()
        
        if choice == "2" or choice == "all":
            await example_setup_friendly_conversation()
            print()
        
        if choice == "3" or choice == "all":
            await example_setup_playful_conversation()
            print()
        
        if choice == "4" or choice == "all":
            await example_configure_existing_conversation()
            print()
        
        if choice == "5" or choice == "all":
            await example_get_conversation_info()
            print()
        
        print("=" * 60)
        print("Examples completed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
