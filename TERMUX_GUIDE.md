# Running AnomChatBot on Android with Termux

## Prerequisites

1. **Install Termux** from F-Droid (NOT Google Play)
   - Download: https://f-droid.org/en/packages/com.termux/
   
2. **Grant storage permission**
   ```bash
   termux-setup-storage
   ```
   Tap "Allow" when prompted

3. **Free up space**
   - Need at least 500MB free

## Installation

### Quick Install (Recommended)

```bash
# Clone repository
pkg install git -y
git clone https://github.com/AnomFIN/AnomChatBot.git
cd AnomChatBot

# Run installer
python runwithtermux.py install

# Setup wizard
python runwithtermux.py setup

# Start bot
python runwithtermux.py run
```

### Manual Install

```bash
# Update packages
pkg update && pkg upgrade -y

# Install dependencies
pkg install python git wget ffmpeg -y

# Clone repo
git clone https://github.com/AnomFIN/AnomChatBot.git
cd AnomChatBot

# Install Python packages
pip install -r requirements.txt

# Configure
cp .env.example .env
nano .env  # Edit with your API keys

# Run
python main.py
```

## Configuration

Edit `.env` file:
```bash
nano .env
```

Required values:
- `OPENAI_API_KEY` - From https://platform.openai.com/
- `TELEGRAM_BOT_TOKEN` - From @BotFather
- `TELEGRAM_ADMIN_IDS` - From @userinfobot

## Running in Background

### Option 1: Termux Wakelock
```bash
# Acquire wakelock (prevents sleep)
termux-wake-lock

# Run bot
python main.py
```

### Option 2: tmux (Recommended)
```bash
# Install tmux
pkg install tmux -y

# Start tmux session
tmux new -s anombot

# Run bot
python main.py

# Detach: Press Ctrl+B, then D
# Reattach: tmux attach -t anombot
```

### Option 3: nohup
```bash
nohup python main.py > bot.log 2>&1 &
```

## Troubleshooting

### Bot crashes on startup
Check logs:
```bash
cat data/logs/anomchatbot.log
```

### Out of memory
Reduce settings in `.env`:
```
MAX_CONVERSATION_HISTORY=20
DEFAULT_MAX_TOKENS=500
```

### WhatsApp connection fails
Delete session:
```bash
rm -rf data/whatsapp_session/*
```

### Can't install packages
Update Termux:
```bash
pkg update && pkg upgrade
```

## Limitations on Android

- **Performance**: Slower than PC/server
- **Battery**: Keep phone charged
- **Memory**: Limited RAM (reduce history)
- **Network**: Wi-Fi recommended
- **WhatsApp**: May disconnect more often

## Tips

1. **Keep screen on**: Settings > Display > Sleep = Never
2. **Disable battery optimization**: For Termux app
3. **Use Wi-Fi**: More stable than mobile data
4. **Monitor logs**: `tail -f data/logs/anomchatbot.log`
5. **Auto-start**: Use Termux:Boot add-on

## Updating

```bash
cd AnomChatBot
git pull
python runwithtermux.py install
```

## Uninstall

```bash
cd ..
rm -rf AnomChatBot
pkg uninstall python
```
