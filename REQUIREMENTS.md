# System Requirements

## Minimum Requirements

### Operating System
- **Linux** (Ubuntu 20.04+ or Debian 10+ recommended)
- Other Unix-like systems may work but are not officially supported
- Windows via WSL2 possible but not recommended for production

### Software

#### Required
- **Node.js**: 18.0.0 or higher (LTS version 20.x recommended)
- **npm**: 8.0.0 or higher (comes with Node.js)
- **Python**: 3.6+ (for installation script)
- **Chrome/Chromium**: Latest stable version (for WhatsApp Web)

#### Automatic Installation
The `install.py` script will attempt to install:
- Chromium browser
- Required system dependencies
- Node.js packages

### Hardware

#### Minimum
- **CPU**: 1 core (2+ recommended)
- **RAM**: 512 MB (1 GB+ recommended)
- **Storage**: 500 MB free space (for dependencies and cache)
- **Network**: Stable internet connection

#### Recommended for Production
- **CPU**: 2+ cores
- **RAM**: 2 GB+
- **Storage**: 2 GB+ free space
- **Network**: Low-latency connection

### Network Requirements

#### Ports
- No incoming ports need to be opened
- Outgoing HTTPS (443) must be allowed

#### Connections Required
- **api.openai.com**: OpenAI API
- **api.telegram.org**: Telegram Bot API
- **web.whatsapp.com**: WhatsApp Web
- **github.com**: For downloading dependencies (during install)

### API Requirements

#### OpenAI API
- Active OpenAI account
- API key with GPT-4 access
- Sufficient credits/billing set up
- Models used:
  - `gpt-4-turbo-preview` (text)
  - `gpt-4-vision-preview` (images)

#### Telegram Bot
- Telegram account
- Bot created via @BotFather
- Bot token
- Your Telegram user ID

#### WhatsApp
- WhatsApp account
- Active phone number
- WhatsApp installed on phone (for QR scan)
- Phone must be online during initial setup

## System Dependencies

### Ubuntu/Debian

```bash
# Update package list
sudo apt-get update

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chromium and dependencies
sudo apt-get install -y \
    chromium-browser \
    chromium-chromedriver \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libnss3 \
    libgbm1

# Python 3 (usually pre-installed)
sudo apt-get install -y python3 python3-pip
```

### CentOS/RHEL/Fedora

```bash
# Install Node.js
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Install Chromium
sudo yum install -y chromium chromium-headless

# Python 3
sudo yum install -y python3 python3-pip
```

### Arch Linux

```bash
# Install Node.js
sudo pacman -S nodejs npm

# Install Chromium
sudo pacman -S chromium

# Python (usually pre-installed)
sudo pacman -S python python-pip
```

## Verification

After installation, verify your setup:

```bash
# Check Node.js
node --version
# Should show: v18.x.x or higher

# Check npm
npm --version
# Should show: 8.x.x or higher

# Check Python
python3 --version
# Should show: Python 3.6.x or higher

# Check Chromium
which chromium-browser || which chromium || which google-chrome
# Should show: path to browser
```

## Resource Usage

### Typical Usage (per conversation)
- **Memory**: ~100-200 MB
- **CPU**: Low (< 5% on 2-core system)
- **Network**: ~1-5 KB/s per active chat
- **Storage**: ~10 MB for session data

### Peak Usage
- **Memory**: ~500 MB (during media processing)
- **CPU**: 20-40% (during AI generation)
- **Network**: Up to 1 MB/s (media downloads)

## Security Considerations

### Filesystem Permissions
```bash
# Recommended: Run as non-root user
# Set appropriate permissions on .env
chmod 600 .env

# Set appropriate permissions on logs
chmod 755 logs/
```

### Network Security
- Use firewall to restrict outgoing connections (optional)
- Keep API keys secure in .env file
- Never commit .env to version control
- Use strong passwords for server access

## Performance Tuning

### For Low-Resource Environments

1. **Reduce log verbosity**
```env
LOG_LEVEL=warn
```

2. **Limit conversation history**
Edit `ConversationManager.js`:
```javascript
// Keep last 50 messages instead of 100
if (conversation.history.length > 50) {
  conversation.history = conversation.history.slice(-50);
}
```

3. **Use lighter AI model**
Edit `AIEngine.js`:
```javascript
model: 'gpt-3.5-turbo'  // Instead of gpt-4
```

### For High-Traffic Environments

1. **Increase Node.js memory**
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

2. **Use process manager**
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start index.js --name anom-chatbot

# Enable auto-restart on server reboot
pm2 startup
pm2 save
```

## Docker Support (Optional)

While not included by default, you can containerize:

```dockerfile
FROM node:20-alpine

# Install Chromium
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

CMD ["npm", "start"]
```

## Cloud Deployment

### Supported Platforms
- ✅ AWS EC2
- ✅ Google Cloud Compute Engine
- ✅ DigitalOcean Droplets
- ✅ Azure Virtual Machines
- ✅ Any Linux VPS

### Recommended Instance Types
- **AWS**: t3.small or t3.medium
- **GCP**: e2-small or e2-medium
- **DigitalOcean**: Basic Droplet ($6-12/month)
- **Azure**: B1s or B2s

## Monitoring

### Logs Location
```
logs/combined.log  # All logs
logs/error.log     # Errors only
```

### Health Check
```bash
# Check if bot is running
ps aux | grep node

# Check last errors
tail -n 50 logs/error.log

# Check system status via Telegram
# Send: /status
```

## Backup Recommendations

### What to Backup
- `.env` file (API keys)
- `.wwebjs_auth/` directory (WhatsApp session)
- `logs/` directory (optional, for troubleshooting)

### What NOT to Backup
- `node_modules/` (reinstall via npm)
- `.wwebjs_cache/` (temporary files)

## Updates

### Updating Dependencies
```bash
# Update npm packages
npm update

# Check for outdated packages
npm outdated

# Update specific package
npm update package-name
```

### Updating Code
```bash
# Pull latest changes
git pull origin main

# Reinstall dependencies
npm install

# Restart bot
npm start
```

---

**Note**: This bot is designed for personal/small-scale use. For enterprise deployment, consider load balancing, database integration, and distributed architecture.
