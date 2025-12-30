# Quick Start Guide

Get AnomChatBot running in 5 minutes!

## Prerequisites

- Linux system (Ubuntu/Debian recommended)
- Python 3.6+
- Internet connection

## Installation

### Step 1: Get API Keys

Before installation, get these:

1. **OpenAI API Key**
   - Go to: https://platform.openai.com/api-keys
   - Create new secret key
   - Save it (starts with `sk-`)

2. **Telegram Bot Token**
   - Open Telegram, search for `@BotFather`
   - Send `/newbot` and follow instructions
   - Save the token (format: `123456:ABC-DEF...`)

3. **Telegram User ID**
   - Open Telegram, search for `@userinfobot`
   - Start chat and get your user ID
   - Save the number

### Step 2: Run Installer

```bash
cd AnomChatBot
python3 install.py
```

The installer will:
- Check system requirements
- Ask for your API keys
- Install Node.js dependencies
- Create configuration file
- Verify everything works

Follow the prompts and enter your keys when asked.

### Step 3: Start Bot

If you chose "Yes" at the end of installation, the bot starts automatically.

Otherwise:
```bash
npm start
```

### Step 4: Connect WhatsApp

1. A QR code appears in terminal
2. Open WhatsApp on your phone
3. Go to: Settings → Linked Devices → Link a Device
4. Scan the QR code
5. Wait for "WhatsApp client is ready!" message

### Step 5: Test Telegram

1. Open Telegram
2. Find your bot (name you gave to BotFather)
3. Send `/start`
4. You should see the control panel welcome message

## First Message Flow

### Scenario: Someone messages you on WhatsApp

1. **Message arrives**
   - Appears in WhatsApp
   - Forwarded to your Telegram bot
   - Shows sender info and message

2. **You respond manually** (REQUIRED FIRST TIME)
   - Reply to the forwarded message in Telegram
   - Your response goes to WhatsApp
   - This is the first message (always manual!)

3. **Enable AI** (optional)
   - Reply to any message from that chat with:
     ```
     /ai You are a 23-year-old who loves tech and gaming
     ```
   - AI now handles all future messages from that person
   - Uses your system prompt for personality

4. **AI responds automatically**
   - When they send more messages
   - AI sees full conversation history
   - Responds in character you defined

## Common Commands

```bash
# Check system status
/status

# List all active chats
/conversations

# Get help
/help

# Stop AI for current chat
/stop_ai
```

## Example Workflow

```
WhatsApp User: "Hey, what's up?"
↓
[Forwarded to Telegram]
↓
You (Telegram): "Not much! Just working on some code. You?"
↓
[Sent to WhatsApp]
↓
You (Telegram): /ai You are a friendly 23-year-old developer
↓
[AI enabled]
↓
WhatsApp User: "Cool! What are you building?"
↓
AI → WhatsApp: "Working on a chatbot project actually! It's pretty interesting. Basically connecting different messaging platforms together."
```

## Troubleshooting

### QR Code not showing?
- Check Node.js is installed: `node --version`
- Try: `rm -rf .wwebjs_auth/` then restart

### Telegram commands not working?
- Make sure you're using the bot you created
- Check TELEGRAM_ADMIN_ID matches your user ID
- Restart the bot

### OpenAI errors?
- Verify API key is correct
- Check your OpenAI account has credits
- Visit: https://platform.openai.com/account/billing

### Bot crashes?
- Check logs: `tail -f logs/error.log`
- Verify all environment variables in `.env`
- Restart: `npm start`

## Configuration File Location

Your settings are in:
```
/path/to/AnomChatBot/.env
```

Edit this file to change API keys or settings.

## Stopping the Bot

Press `Ctrl+C` in the terminal where the bot is running.

## Next Steps

- Read full README.md for advanced features
- Try media messages (images, videos)
- Experiment with different AI personalities
- Customize conversation settings

## Support

- Check README.md for detailed documentation
- Review logs in `logs/` directory
- Ensure all services are properly configured

---

**Remember**: 
- First message is ALWAYS manual
- Enable AI only after first response
- Each conversation has its own AI settings
- You can always disable AI with `/stop_ai`

Enjoy your chatbot! 🎉
