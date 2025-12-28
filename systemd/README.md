# Systemd Service Setup

For production deployments, you can run AnomChatBot as a systemd service for automatic startup and management.

## Installation

1. **Copy service file**
```bash
sudo cp systemd/anomchatbot.service /etc/systemd/system/
```

2. **Edit service file** (adjust paths and user)
```bash
sudo nano /etc/systemd/system/anomchatbot.service
```

Update these lines to match your setup:
- `User=anomchatbot` → Your username
- `WorkingDirectory=/home/anomchatbot/AnomChatBot` → Your path
- `ExecStart=/usr/bin/node index.js` → Verify node path with `which node`

3. **Reload systemd**
```bash
sudo systemctl daemon-reload
```

4. **Enable service** (start on boot)
```bash
sudo systemctl enable anomchatbot
```

5. **Start service**
```bash
sudo systemctl start anomchatbot
```

## Management Commands

```bash
# Start service
sudo systemctl start anomchatbot

# Stop service
sudo systemctl stop anomchatbot

# Restart service
sudo systemctl restart anomchatbot

# Check status
sudo systemctl status anomchatbot

# View logs
sudo journalctl -u anomchatbot -f

# View last 100 lines
sudo journalctl -u anomchatbot -n 100

# Disable auto-start
sudo systemctl disable anomchatbot
```

## First Run with Systemd

**Important**: WhatsApp requires QR code scanning on first run.

For initial setup:

1. Run manually first to scan QR code:
```bash
cd /path/to/AnomChatBot
npm start
```

2. Scan QR code with WhatsApp

3. Wait for "ready" message

4. Stop with Ctrl+C

5. Now start as service:
```bash
sudo systemctl start anomchatbot
```

The WhatsApp session is saved in `.wwebjs_auth/` and will persist across restarts.

## Troubleshooting

### Service won't start

Check logs:
```bash
sudo journalctl -u anomchatbot -n 50
```

Common issues:
- Wrong user in service file
- Wrong path in WorkingDirectory
- Missing .env file
- Node.js not in PATH

### Permission issues

Ensure the service user can access:
- Working directory
- logs/ directory
- .wwebjs_auth/ directory
- .env file

```bash
# Set ownership
sudo chown -R your-user:your-user /path/to/AnomChatBot

# Set permissions
chmod 600 .env
chmod 755 logs/
chmod 755 .wwebjs_auth/
```

### Service crashes immediately

Check:
1. Environment variables in .env
2. Node.js version: `node --version`
3. Dependencies installed: `ls node_modules/`
4. Syntax errors: `node --check index.js`

## Monitoring

### Health Check

Create a simple monitoring script:

```bash
#!/bin/bash
# monitor.sh

if systemctl is-active --quiet anomchatbot; then
    echo "✅ AnomChatBot is running"
else
    echo "❌ AnomChatBot is not running"
    sudo systemctl start anomchatbot
    echo "🔄 Attempted restart"
fi
```

Run with cron:
```bash
# Edit crontab
crontab -e

# Add line to check every 5 minutes
*/5 * * * * /path/to/monitor.sh
```

### Log Rotation

The service uses journalctl by default. Configure retention:

```bash
# Edit journald config
sudo nano /etc/systemd/journald.conf

# Set limits
SystemMaxUse=500M
SystemMaxFileSize=100M
MaxRetentionSec=1week
```

Restart journald:
```bash
sudo systemctl restart systemd-journald
```

## Security Hardening

The included service file has basic security settings:
- `NoNewPrivileges=true` - Prevent privilege escalation
- `PrivateTmp=true` - Private /tmp directory
- `ProtectSystem=strict` - Read-only system directories
- `ProtectHome=true` - No access to other users' home
- `ReadWritePaths=...` - Only specific directories writable

For additional security, consider:
- Running as dedicated user with no shell
- Using AppArmor or SELinux profiles
- Restricting network access with firewall
- Regular security updates

## Updates

To update AnomChatBot:

```bash
# Stop service
sudo systemctl stop anomchatbot

# Update code
cd /path/to/AnomChatBot
git pull origin main
npm install

# Start service
sudo systemctl start anomchatbot

# Check status
sudo systemctl status anomchatbot
```

## Uninstallation

```bash
# Stop and disable service
sudo systemctl stop anomchatbot
sudo systemctl disable anomchatbot

# Remove service file
sudo rm /etc/systemd/system/anomchatbot.service

# Reload systemd
sudo systemctl daemon-reload
```

---

**Note**: For development, use `npm start` directly. Use systemd for production deployments where automatic restart and logging are needed.
