# Web GUI Documentation

## Overview

AnomChatBot now includes a beautiful web-based GUI that allows you to use the bot **without requiring Telegram**. The Web GUI provides all the functionality needed to manage conversations, send messages, and configure the bot through a modern, responsive web interface.

## Features

### 🎨 Modern Interface
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Updates**: WebSocket integration for instant message notifications
- **Beautiful UI**: Clean, intuitive design with smooth animations
- **Dark/Light Theme**: Easy on the eyes with professional styling

### 💬 Chat Management
- **Conversation List**: View all active WhatsApp conversations
- **Message History**: Browse full conversation history
- **Send Messages**: Reply to messages directly from the web interface
- **Real-time Sync**: Messages update automatically via WebSocket

### ⚙️ Configuration
- **Telegram Toggle**: Enable or disable Telegram integration
- **API Settings**: Configure OpenAI, WhatsApp, and Telegram settings
- **Bot Status**: Monitor connection status for all services

## Quick Start

### 1. Enable Web GUI

Edit your `.env` file:

```bash
# Enable Web GUI
WEB_GUI_ENABLED=true
WEB_GUI_HOST=0.0.0.0
WEB_GUI_PORT=3001

# Make Telegram optional
TELEGRAM_ENABLED=false
```

### 2. Install Dependencies

```bash
pip install Flask Flask-CORS Flask-SocketIO python-socketio
```

Or using the requirements file:

```bash
pip install -r requirements.txt
```

### 3. Start the Bot

```bash
python main.py
```

The web GUI will be available at: **http://localhost:3001/**

## Usage Modes

### Mode 1: Web GUI Only (No Telegram)

Perfect for users who don't want to use Telegram:

```bash
WEB_GUI_ENABLED=true
TELEGRAM_ENABLED=false
```

- All bot control through web interface
- No Telegram bot token required
- WhatsApp + OpenAI only

### Mode 2: Web GUI + Telegram

Use both control methods:

```bash
WEB_GUI_ENABLED=true
TELEGRAM_ENABLED=true
```

- Control bot from web GUI or Telegram
- Dual interface for maximum flexibility
- All features available in both interfaces

### Mode 3: Traditional (Telegram Only)

Original mode without web GUI:

```bash
WEB_GUI_ENABLED=false
TELEGRAM_ENABLED=true
```

- Original Telegram-only control
- No web server required

## Web GUI Features

### Dashboard

The main dashboard shows:
- **Status Indicators**: Real-time connection status for WhatsApp, Telegram, and OpenAI
- **Active Conversations**: Number of ongoing chats
- **Quick Actions**: Access to settings and status details

### Conversations Panel

Left sidebar showing:
- **Search Bar**: Filter conversations by contact name
- **Conversation List**: All active chats with preview
- **Contact Names**: Display names from WhatsApp
- **Last Message Time**: When each conversation was last active
- **AI Status Badge**: Shows which conversations have AI enabled

### Chat Interface

Main chat area featuring:
- **Message History**: Full conversation history with timestamps
- **Message Input**: Text area for composing messages
- **Send Button**: Send messages to WhatsApp
- **Keyboard Shortcuts**: Press Enter to send (Shift+Enter for new line)
- **Real-time Updates**: New messages appear instantly

### Settings Modal

Configuration panel for:
- **Telegram Toggle**: Enable/disable Telegram integration
- **API Keys**: OpenAI API key configuration
- **OpenAI Model**: Select GPT model (GPT-4, GPT-3.5, etc.)
- **WhatsApp Path**: Configure session storage location
- **Telegram Config**: Bot token and admin IDs

### Status Modal

Detailed system status:
- **Bot Status**: Running/Stopped
- **Active Conversations**: Count of ongoing chats
- **WhatsApp Status**: Connection state
- **Telegram Status**: Connection state (if enabled)
- **Last Updated**: Timestamp of status check

## API Endpoints

The Web GUI server exposes the following REST API:

### GET /api/status
Get current bot status

**Response:**
```json
{
  "bot_running": true,
  "telegram_enabled": false,
  "telegram_status": "disconnected",
  "whatsapp_status": "connected",
  "openai_status": "connected",
  "active_conversations": 5,
  "timestamp": "2026-01-11T12:53:07Z"
}
```

### GET /api/conversations
List all conversations

**Response:**
```json
[
  {
    "chat_id": "1234567890@c.us",
    "contact_name": "John Doe",
    "last_message": "2026-01-11T12:45:00Z",
    "message_count": 42,
    "ai_enabled": true
  }
]
```

### GET /api/messages/:chat_id
Get messages for a conversation

**Parameters:**
- `chat_id` (path): WhatsApp chat ID
- `limit` (query): Number of messages to retrieve (default: 50)

**Response:**
```json
[
  {
    "id": 1,
    "role": "user",
    "content": "Hello!",
    "timestamp": "2026-01-11T12:40:00Z"
  },
  {
    "id": 2,
    "role": "assistant",
    "content": "Hi there!",
    "timestamp": "2026-01-11T12:40:05Z"
  }
]
```

### POST /api/send
Send a message

**Request Body:**
```json
{
  "chat_id": "1234567890@c.us",
  "message": "Your message here"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET /api/config
Get current configuration

**Response:**
```json
{
  "telegram_enabled": false,
  "openai_model": "gpt-4-turbo-preview",
  "bot_name": "AnomChatBot"
}
```

### POST /api/config
Update configuration

**Request Body:**
```json
{
  "telegram_enabled": false
}
```

**Response:**
```json
{
  "success": true
}
```

## WebSocket Events

The Web GUI uses Socket.IO for real-time updates:

### Server → Client Events

#### `connected`
Sent when client connects to server
```json
{
  "status": "connected"
}
```

#### `new_message`
Sent when a new message is received or sent
```json
{
  "chat_id": "1234567890@c.us",
  "role": "user",
  "content": "Message text",
  "timestamp": "2026-01-11T12:53:07Z"
}
```

#### `status_update`
Sent when bot status changes
```json
{
  "whatsapp_status": "connected",
  "telegram_status": "disconnected",
  "bot_running": true
}
```

## Security Considerations

### API Access
- The Web GUI server binds to `0.0.0.0` by default (all interfaces)
- For production, consider using a reverse proxy (nginx/Apache)
- Add authentication if exposing to the internet
- Use HTTPS in production

### Environment Variables
- Never commit `.env` file to version control
- Store API keys securely
- Rotate keys regularly

### Network Security
- Use firewall to restrict access to port 3001
- Consider VPN for remote access
- Implement rate limiting for production

## Troubleshooting

### Web GUI won't start

**Problem:** Server fails to start
**Solution:** Check if port 3001 is already in use
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process or change WEB_GUI_PORT in .env
```

### Can't connect to Web GUI

**Problem:** Browser can't reach http://localhost:3001
**Solution:** 
- Check if server is running
- Try http://127.0.0.1:3001
- Check firewall settings
- Verify `WEB_GUI_ENABLED=true` in .env

### Messages not updating in real-time

**Problem:** New messages don't appear automatically
**Solution:**
- Check browser console for WebSocket errors
- Refresh the page
- Check if Socket.IO client library loaded
- Verify server logs for WebSocket connection

### Telegram toggle not working

**Problem:** Enabling/disabling Telegram has no effect
**Solution:**
- Restart the bot after changing settings
- Check `.env` file was updated
- Verify you have write permissions to `.env`

## Advanced Configuration

### Custom Port

Change the web GUI port:

```bash
WEB_GUI_PORT=8080
```

### Custom Host

Bind to specific interface:

```bash
# Localhost only (more secure)
WEB_GUI_HOST=127.0.0.1

# All interfaces (default)
WEB_GUI_HOST=0.0.0.0
```

### Behind Reverse Proxy

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name chatbot.example.com;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Screenshots

### Dashboard View
The main dashboard shows status indicators and conversation list.

### Chat Interface
Modern chat interface with message history and input area.

### Settings Panel
Configure all bot settings through the web interface.

## Standalone Web GUI Server

You can also run the web GUI server independently:

```bash
python chatbotserver.py
```

This starts only the web server without the full bot, useful for:
- Testing the web interface
- Development and debugging
- Separate deployment scenarios

## Development

### File Structure

```
AnomChatBot/
├── chatbotserver.py       # Flask server
├── main.py                # Main bot with web GUI integration
├── web/
│   ├── webgui.html        # Web GUI HTML
│   ├── webgui.css         # Styles
│   └── webgui.js          # Client-side JavaScript
└── requirements.txt       # Dependencies
```

### Adding New Features

1. Add API endpoint in `chatbotserver.py`
2. Add UI elements in `webgui.html`
3. Style with `webgui.css`
4. Add logic in `webgui.js`
5. Test with real bot instance

## Support

For issues or questions:
1. Check this documentation
2. Review server logs: `data/logs/anomchatbot.log`
3. Check browser console for client errors
4. Open an issue on GitHub

## Future Enhancements

Planned features:
- [ ] User authentication
- [ ] Multi-user support
- [ ] Message search functionality
- [ ] File/media upload through web GUI
- [ ] Conversation analytics
- [ ] Custom themes
- [ ] Mobile app companion
- [ ] Voice message playback

---

**Note**: The Web GUI is designed to work seamlessly with or without Telegram, giving you complete flexibility in how you control AnomChatBot.
