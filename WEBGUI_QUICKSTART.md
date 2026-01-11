# Web GUI Quick Start Guide

Get AnomChatBot running with the Web GUI in 5 minutes!

## Prerequisites

- Python 3.8 or higher
- OpenAI API key
- Internet connection

**Note:** Telegram is **NOT** required when using Web GUI mode!

## Step 1: Clone Repository

```bash
git clone https://github.com/AnomFIN/AnomChatBot.git
cd AnomChatBot
```

## Step 2: Quick Setup

### Option A: Automatic (Recommended)

```bash
./start_webgui.sh
```

The script will:
- Create `.env` file from template
- Create virtual environment
- Install all dependencies
- Start the bot with Web GUI

### Option B: Manual Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file:**
   ```bash
   nano .env  # or use any text editor
   ```

   Minimum configuration for Web GUI only:
   ```bash
   # OpenAI (Required)
   OPENAI_API_KEY=sk-your-api-key-here
   
   # Web GUI (Enable it)
   WEB_GUI_ENABLED=true
   WEB_GUI_PORT=3001
   
   # Telegram (Disable it for Web GUI only)
   TELEGRAM_ENABLED=false
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the bot:**
   ```bash
   python3 main.py
   ```

## Step 3: Access Web GUI

Open your browser and go to:

```
http://localhost:3001/
```

You should see the AnomChatBot Web GUI dashboard!

## Step 4: Connect WhatsApp

1. The bot will generate a QR code in the console
2. Open WhatsApp on your phone
3. Go to Settings → Linked Devices → Link a Device
4. Scan the QR code shown in the console
5. Wait for "WhatsApp connected" status in Web GUI

## Step 5: Start Chatting!

1. Send a message to your WhatsApp number from another phone
2. The conversation will appear in the Web GUI sidebar
3. Click on the conversation to open it
4. View the message history
5. Type your reply and click Send
6. The message will be sent via WhatsApp!

## Common Use Cases

### Web GUI Only (No Telegram)

Perfect for personal use or when you don't want Telegram dependency.

**.env configuration:**
```bash
OPENAI_API_KEY=sk-your-key
WEB_GUI_ENABLED=true
TELEGRAM_ENABLED=false
```

**Advantages:**
- Simpler setup (no Telegram bot token needed)
- Clean web interface
- No additional app needed
- Works on any device with a browser

### Web GUI + Telegram (Dual Mode)

Use both interfaces for maximum flexibility.

**.env configuration:**
```bash
OPENAI_API_KEY=sk-your-key
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ADMIN_IDS=your-telegram-id
WEB_GUI_ENABLED=true
TELEGRAM_ENABLED=true
```

**Advantages:**
- Control bot from web OR Telegram
- Telegram notifications on mobile
- Web GUI for desktop work
- Best of both worlds

## Troubleshooting

### Port Already in Use

If port 3001 is taken:

```bash
# In .env file, change:
WEB_GUI_PORT=8080  # or any other free port
```

### Can't Access Web GUI

1. Check if bot is running
2. Try `http://127.0.0.1:3001` instead
3. Check firewall settings
4. Verify `WEB_GUI_ENABLED=true` in .env

### WhatsApp Won't Connect

1. Make sure Chrome/Chromium is installed
2. Check console for QR code
3. If QR expired, restart the bot
4. Check `.wwebjs_auth` directory permissions

### OpenAI API Errors

1. Verify API key is correct
2. Check you have credits: https://platform.openai.com/usage
3. Ensure no extra spaces in .env file

## Features Overview

### ✅ What Works in Web GUI

- ✅ View all conversations
- ✅ Read message history
- ✅ Send messages to WhatsApp
- ✅ Real-time message updates
- ✅ Bot status monitoring
- ✅ Configure Telegram on/off
- ✅ Beautiful responsive UI

### 🚧 Coming Soon

- 🚧 Media upload (images, videos)
- 🚧 Voice message playback
- 🚧 AI configuration per conversation
- 🚧 User authentication
- 🚧 Multi-user support

## Next Steps

1. **Configure AI Personality**: Edit system prompts in settings
2. **Enable AI Auto-Reply**: Set up automatic responses
3. **Customize Settings**: Adjust tone, temperature, etc.
4. **Read Full Docs**: Check [WEBGUI.md](WEBGUI.md) for advanced features

## Getting Help

- **Documentation**: See [WEBGUI.md](WEBGUI.md) for detailed guide
- **Issues**: Open an issue on GitHub
- **Logs**: Check `data/logs/anomchatbot.log` for errors

## Security Note

⚠️ The Web GUI binds to `0.0.0.0` by default (accessible from network).

For security:
- Use `WEB_GUI_HOST=127.0.0.1` to restrict to localhost only
- Set up authentication if exposing to internet
- Use reverse proxy with HTTPS in production
- Don't share your API keys

## That's It!

You're now running AnomChatBot with the Web GUI. Enjoy! 🎉

For more advanced features and configuration options, see the full documentation:
- [WEBGUI.md](WEBGUI.md) - Complete Web GUI guide
- [README.md](README.md) - Full project documentation
- [API.md](API.md) - API reference
