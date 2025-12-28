# AnomChatBot

**Trip (350 chars):** Ihmisen ohjaama chatbot-silta, joka yhdistää WhatsAppin, Telegramin ja OpenAI:n. Operaattori hallitsee keskusteluja Telegram-paneelistä, lähettäen ensimmäisen viestin käsin ja aktivoiden tekoälyn tarpeen mukaan. Keskustelukohtaiset asetukset ja täysi viestihistoria. Tuotantovalmis modulaarinen Node.js-järjestelmä automaattisella reconnect-logiikalla ja vikasiedolla.

**Jab Start (500 chars):** Telegram-ohjattu chatbot-alusta WhatsApp-keskusteluihin tekoälyn avulla. Järjestelmä vaatii, että ensimmäinen viesti lähetetään aina manuaalisesti, minkä yhteydessä määritetään tekoälyhahmon persoona system promptilla. Tekoäly esiintyy aitona nuorena henkilönä, ei AI-assistenttina. Tukee kuvia, videoita ja ääniviestejä. Keskustelut ovat täysin hallittavissa Telegram-paneelista komennoin ja asetuksin. Modulaarinen arkkitehtuuri: WhatsApp-silta, Telegram-kontrolleri, AI-moottori, keskustelunhallinta, mediankäsittely. Automaattinen yhteyden palautus ja virheenkäsittely.

## 🎯 Overview

Production-ready chatbot bridge system that connects WhatsApp, Telegram, and OpenAI, controlled by a human operator.

### Key Features

- **Human-in-the-loop**: Operator controls AI through Telegram control panel
- **First message manual**: Always requires human to initiate conversation
- **Conversation-specific settings**: Customizable AI personality per chat
- **Full message history**: Complete context for AI responses
- **Media support**: Images, videos, audio messages with AI analysis
- **Production-ready**: Auto-reconnect, error handling, logging
- **Modular architecture**: Clean separation of concerns

## 🏗️ Architecture

```
WhatsApp ↔ WhatsAppBridge ↔ ConversationManager ↔ TelegramController
                                    ↕
                              AIEngine (OpenAI)
                                    ↕
                              MediaHandler
```

### Modules

- **WhatsAppBridge**: WhatsApp connection and message handling
- **TelegramController**: Operator control panel with commands
- **AIEngine**: OpenAI integration and response generation
- **ConversationManager**: State, history, and settings management
- **MediaHandler**: Media processing and AI analysis
- **Logger**: Centralized logging system

## 📋 Requirements

- **Node.js** 18+ (LTS recommended)
- **npm** 8+
- **Linux** environment (Ubuntu/Debian recommended)
- **Chrome/Chromium** browser (for WhatsApp Web)
- **OpenAI API** key
- **Telegram Bot** token

## 🚀 Installation

### Quick Install (Recommended)

```bash
python3 install.py
```

The installation script will:
1. Check system requirements
2. Ask for configuration (API keys, tokens)
3. Create `.env` file
4. Install dependencies
5. Verify installation
6. Optionally start the bot

### Manual Installation

1. **Clone repository**
```bash
git clone https://github.com/AnomFIN/AnomChatBot.git
cd AnomChatBot
```

2. **Install Node.js dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your values
```

4. **Required environment variables:**
```env
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_ADMIN_ID=123456789
LOG_LEVEL=info
```

## 🎮 Usage

### Starting the Bot

```bash
npm start
# or
npm run dev
# or
node index.js
```

### First Time Setup

1. **Start the bot** - You'll see a QR code in the terminal
2. **Scan QR code** with WhatsApp on your phone
3. **Wait for "ready"** message in terminal and Telegram
4. **Done!** Bot is ready to handle messages

## 📱 Telegram Control Panel

### Basic Commands

- `/start` - Show welcome and command list
- `/status` - System status (connections, errors)
- `/conversations` - List active chats
- `/help` - Detailed help guide

### Working with Conversations

1. **Receive message**: WhatsApp message automatically forwarded to Telegram
2. **Manual response**: Reply to the forwarded message
3. **Enable AI**: Reply with `/ai [system_prompt]`
   ```
   /ai You are a friendly 22-year-old interested in fitness
   ```
4. **AI handles rest**: Subsequent messages answered automatically

### AI Control

```bash
# Enable AI with custom personality
/ai You are a young professional who loves tech and gaming

# Stop AI for current chat
/stop_ai

# Clear conversation history
/clear
```

### Settings (per conversation)

```bash
# Set flirt level (0.1 - 1.0)
/set_flirt 0.7

# Set tone
/set_tone friendly
/set_tone distant
/set_tone playful

# Set response speed
/set_speed fast
/set_speed normal
/set_speed slow
```

## 🧠 How AI Works

### System Prompt
- Set with first AI activation: `/ai [your_prompt]`
- Defines AI personality for the conversation
- Remains active for all subsequent messages
- Example: "You are a 23-year-old software developer who loves gaming and fitness. Chat naturally on WhatsApp."

### Conversation Context
- Full message history maintained
- Last 20 messages sent to AI for context
- Media descriptions included in context
- AI responds based on entire conversation flow

### AI Personality
- **Human-like**: No "AI assistant" behavior
- **Brief responses**: Like real WhatsApp chat
- **Natural language**: No formal structure
- **Context-aware**: Remembers previous messages

## 🖼️ Media Handling

### Supported Media Types

- **Images**: AI can analyze and comment (via GPT-4 Vision)
- **Videos**: Detected and acknowledged
- **Audio**: Voice messages detected
- **Documents**: PDFs and files detected

### AI Media Analysis

When user sends an image:
1. Image downloaded from WhatsApp
2. Sent to GPT-4 Vision for analysis
3. AI generates natural comment
4. Full context maintained for conversation

Example:
```
User: [sends coffee cup image]
AI: "Nice coffee! Espresso or cappuccino?"
```

## 🔧 Configuration

### Conversation Settings

Each conversation has independent settings:

```javascript
{
  flirtLevel: 0.5,        // 0.1 - 1.0
  tone: 'friendly',       // friendly, distant, playful
  responseSpeed: 'normal', // fast, normal, slow
  aiAggressiveness: 0.5   // 0.1 - 1.0
}
```

These affect:
- AI temperature (creativity)
- Response length
- Personality expression

### Logging

Logs stored in `logs/` directory:
- `combined.log` - All logs
- `error.log` - Errors only

Log level configurable in `.env`:
```env
LOG_LEVEL=info  # error, warn, info, debug
```

## 🛡️ Error Handling

### Auto-Reconnect

- **WhatsApp disconnects**: Automatic reconnection with exponential backoff
- **OpenAI errors**: Graceful fallback, operator notification
- **Network issues**: Retry logic with configurable attempts

### Fault Tolerance

- **OpenAI down**: Bot continues, manual responses work
- **WhatsApp down**: Telegram notifications, auto-reconnect
- **Telegram down**: Queued messages, retry on reconnect

### Notifications

Operator receives Telegram notifications for:
- Connection status changes
- AI response failures
- Critical errors
- System restarts

## 📁 Project Structure

```
AnomChatBot/
├── index.js                 # Main application entry
├── package.json            # Dependencies
├── .env.example            # Environment template
├── .gitignore             # Git ignore rules
├── install.py             # Installation script
├── README.md              # This file
├── src/
│   ├── bridges/
│   │   ├── WhatsAppBridge.js      # WhatsApp connection
│   │   └── TelegramController.js  # Telegram bot
│   ├── managers/
│   │   ├── AIEngine.js            # OpenAI integration
│   │   └── ConversationManager.js # State management
│   ├── handlers/
│   │   └── MediaHandler.js        # Media processing
│   └── utils/
│       └── logger.js              # Logging utility
└── logs/                  # Log files (auto-created)
```

## 🔐 Security

### Best Practices

- **No hardcoded keys**: All sensitive data in `.env`
- **Admin-only access**: Telegram commands restricted to admin
- **Secure sessions**: WhatsApp auth stored locally
- **Error handling**: No sensitive data in error messages

### Environment Variables

Never commit `.env` file to version control. Use `.env.example` as template.

## 🐛 Troubleshooting

### WhatsApp won't connect

```bash
# Remove session and restart
rm -rf .wwebjs_auth/
node index.js
```

### Telegram commands not working

Check admin ID:
```bash
# Get your user ID
# Message @userinfobot on Telegram
# Update TELEGRAM_ADMIN_ID in .env
```

### OpenAI API errors

- Check API key is valid
- Verify account has credits
- Check rate limits

### Dependencies issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

## 📝 Development

### Running in Development

```bash
npm run dev
```

### Logs

Monitor logs in real-time:
```bash
tail -f logs/combined.log
```

### Testing

Send test message:
1. Send WhatsApp message to connected number
2. Check Telegram for forwarded message
3. Reply in Telegram
4. Verify delivery in WhatsApp

## 🤝 Contributing

This is a production system. Contributions should maintain:
- Code quality and documentation
- Modular architecture
- Error handling
- Security best practices

## 📄 License

MIT License - See LICENSE file

## 👤 Author

**AnomFIN**

## 🙏 Acknowledgments

- **whatsapp-web.js** - WhatsApp Web API
- **node-telegram-bot-api** - Telegram Bot API
- **OpenAI** - GPT-4 and Vision APIs
- **winston** - Logging framework

---

**Note**: This is a human-controlled chatbot system, not an automated spam tool. Always respect privacy and terms of service of all platforms.
