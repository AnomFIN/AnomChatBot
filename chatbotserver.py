"""
Web GUI Server for AnomChatBot
Simple Flask-based server for web GUI communication
"""
import os
import sys
import json
import asyncio
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional
from threading import Thread
from flask import Flask, render_template, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from loguru import logger

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.config import get_config
from src.database import DatabaseManager

app = Flask(__name__, static_folder='web', template_folder='web')
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Global state
bot_manager = None
config = None
db = None


class WebGUIBotManager:
    """Manager for bot state and operations accessible from web GUI"""
    
    def __init__(self):
        self.bot_instance = None
        self.config = None
        self.db = None
        self.telegram_enabled = True
        self.whatsapp_status = "disconnected"
        self.telegram_status = "disconnected"
        self.openai_status = "unknown"
        self.active_conversations = []
        
    async def initialize(self, enable_telegram=True):
        """Initialize bot components"""
        self.telegram_enabled = enable_telegram
        self.config = get_config()
        
        # Initialize database
        self.db = DatabaseManager(self.config.database_url)
        await self.db.init_db()
        logger.info("Database initialized for web GUI")
        
    async def get_status(self) -> Dict[str, Any]:
        """Get current bot status"""
        status = {
            "bot_running": self.bot_instance is not None,
            "telegram_enabled": self.telegram_enabled,
            "telegram_status": self.telegram_status,
            "whatsapp_status": self.whatsapp_status,
            "openai_status": self.openai_status,
            "active_conversations": len(self.active_conversations),
            "timestamp": datetime.now().isoformat()
        }
        
        if self.db:
            try:
                bot_status = await self.db.get_bot_status()
                if bot_status:
                    status.update({
                        "whatsapp_status": "connected" if bot_status.get("whatsapp_connected") else "disconnected",
                        "telegram_status": "connected" if bot_status.get("telegram_connected") else "disconnected"
                    })
            except Exception as e:
                logger.error(f"Error getting bot status from DB: {e}")
        
        return status
    
    async def get_conversations(self) -> List[Dict[str, Any]]:
        """Get list of conversations"""
        if not self.db:
            return []
        
        try:
            conversations = await self.db.get_conversations()
            return [
                {
                    "chat_id": conv.chat_id,
                    "contact_name": conv.contact_name or "Unknown",
                    "last_message": conv.last_message_at.isoformat() if conv.last_message_at else None,
                    "message_count": conv.message_count or 0,
                    "ai_enabled": conv.ai_enabled or False
                }
                for conv in conversations
            ]
        except Exception as e:
            logger.error(f"Error getting conversations: {e}")
            return []
    
    async def get_messages(self, chat_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get messages for a conversation"""
        if not self.db:
            return []
        
        try:
            messages = await self.db.get_messages(chat_id, limit=limit)
            return [
                {
                    "id": msg.id,
                    "role": msg.role,
                    "content": msg.content,
                    "timestamp": msg.timestamp.isoformat()
                }
                for msg in messages
            ]
        except Exception as e:
            logger.error(f"Error getting messages: {e}")
            return []
    
    async def send_message(self, chat_id: str, message: str) -> bool:
        """Send a message to WhatsApp"""
        try:
            if not self.bot_instance:
                logger.error("Bot not running")
                return False
            
            # Get WhatsApp bot instance
            if hasattr(self.bot_instance, 'whatsapp_bot'):
                await self.bot_instance.whatsapp_bot.send_message(chat_id, message)
                
                # Save to database
                if self.db:
                    await self.db.add_message(chat_id, "assistant", message)
                
                # Emit to connected clients
                socketio.emit('new_message', {
                    'chat_id': chat_id,
                    'role': 'assistant',
                    'content': message,
                    'timestamp': datetime.now().isoformat()
                })
                
                return True
            else:
                logger.error("WhatsApp bot not available")
                return False
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            return False


# Create global manager
bot_manager = WebGUIBotManager()


@app.route('/')
def index():
    """Serve main web GUI page"""
    return send_from_directory('web', 'webgui.html')


@app.route('/api/status')
def api_status():
    """Get bot status"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    status = loop.run_until_complete(bot_manager.get_status())
    loop.close()
    return jsonify(status)


@app.route('/api/conversations')
def api_conversations():
    """Get list of conversations"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    conversations = loop.run_until_complete(bot_manager.get_conversations())
    loop.close()
    return jsonify(conversations)


@app.route('/api/messages/<chat_id>')
def api_messages(chat_id):
    """Get messages for a conversation"""
    limit = request.args.get('limit', 50, type=int)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    messages = loop.run_until_complete(bot_manager.get_messages(chat_id, limit))
    loop.close()
    return jsonify(messages)


@app.route('/api/send', methods=['POST'])
def api_send():
    """Send a message"""
    data = request.get_json()
    chat_id = data.get('chat_id')
    message = data.get('message')
    
    if not chat_id or not message:
        return jsonify({"success": False, "error": "Missing chat_id or message"}), 400
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    success = loop.run_until_complete(bot_manager.send_message(chat_id, message))
    loop.close()
    
    return jsonify({"success": success})


@app.route('/api/config', methods=['GET', 'POST'])
def api_config():
    """Get or update configuration"""
    if request.method == 'GET':
        # Return current config (sanitized)
        return jsonify({
            "telegram_enabled": bot_manager.telegram_enabled,
            "openai_model": config.openai_model if config else None,
            "bot_name": config.bot_name if config else "AnomChatBot"
        })
    else:
        # Update configuration
        data = request.get_json()
        telegram_enabled = data.get('telegram_enabled', True)
        bot_manager.telegram_enabled = telegram_enabled
        
        # Save to .env file
        env_path = Path(__file__).parent / '.env'
        if env_path.exists():
            with open(env_path, 'r') as f:
                lines = f.readlines()
            
            updated = False
            for i, line in enumerate(lines):
                if line.startswith('TELEGRAM_ENABLED='):
                    lines[i] = f'TELEGRAM_ENABLED={telegram_enabled}\n'
                    updated = True
                    break
            
            if not updated:
                lines.append(f'TELEGRAM_ENABLED={telegram_enabled}\n')
            
            with open(env_path, 'w') as f:
                f.writelines(lines)
        
        return jsonify({"success": True})


@socketio.on('connect')
def handle_connect():
    """Handle WebSocket connection"""
    logger.info("Web GUI client connected")
    emit('connected', {'status': 'connected'})


@socketio.on('disconnect')
def handle_disconnect():
    """Handle WebSocket disconnection"""
    logger.info("Web GUI client disconnected")


def run_server(host='0.0.0.0', port=3001):
    """Run the Flask server"""
    logger.info(f"Starting Web GUI server at http://{host}:{port}")
    logger.info(f"Web GUI URL: http://localhost:{port}/")
    socketio.run(app, host=host, port=port, debug=False, allow_unsafe_werkzeug=True)


async def initialize_bot_manager(enable_telegram=True):
    """Initialize bot manager"""
    global config, db
    await bot_manager.initialize(enable_telegram)
    config = bot_manager.config
    db = bot_manager.db


if __name__ == '__main__':
    # Configure logging
    logger.remove()
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan> - <level>{message}</level>",
        level="INFO"
    )
    
    # Check if telegram should be disabled
    telegram_enabled = os.getenv('TELEGRAM_ENABLED', 'true').lower() == 'true'
    
    logger.info("=" * 60)
    logger.info("AnomChatBot Web GUI Server")
    logger.info(f"Telegram Mode: {'Enabled' if telegram_enabled else 'Disabled'}")
    logger.info("=" * 60)
    
    # Initialize bot manager
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(initialize_bot_manager(telegram_enabled))
    loop.close()
    
    # Start server
    run_server()
