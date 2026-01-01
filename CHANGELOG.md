# Changelog

All notable changes to AnomChatBot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-12-28

### Added
- **Core System**: Complete chatbot bridge connecting WhatsApp, Telegram, and OpenAI
- **WhatsApp Bridge**: Full WhatsApp Web integration with auto-reconnect
- **Telegram Controller**: Operator control panel with comprehensive commands
- **AI Engine**: OpenAI GPT-4 and Vision API integration
- **Conversation Manager**: State management, history tracking, per-conversation settings
- **Media Handler**: Support for images, videos, audio with AI analysis
- **Logging System**: Winston-based logging with file rotation
- **Installation Script**: Professional Python installer for Linux
- **Documentation**: Comprehensive README, Quick Start Guide, Requirements doc
- **Error Handling**: Graceful error handling and recovery
- **Auto-Reconnect**: Automatic reconnection for all services
- **System Monitoring**: Status commands and health checks

### Features
- Human-in-the-loop design: Operator controls AI through Telegram
- First message always manual requirement
- Conversation-specific AI personalities via system prompts
- Per-conversation settings (flirt level, tone, speed, aggressiveness)
- Full message history with context awareness
- Media content analysis with GPT-4 Vision
- Real-time message forwarding to Telegram
- Manual and AI response modes
- Active conversation management
- Production-ready architecture

### Commands
- `/start` - Welcome and command list
- `/status` - System status check
- `/conversations` - List active chats
- `/help` - Detailed help guide
- `/ai [prompt]` - Enable AI with custom personality
- `/stop_ai` - Disable AI for conversation
- `/set_flirt` - Adjust flirt level
- `/set_tone` - Set conversation tone
- `/set_speed` - Adjust response speed

### Technical
- Node.js 18+ with ES modules
- Modular architecture (bridges, managers, handlers)
- WhatsApp session persistence
- Telegram bot with admin-only access
- OpenAI API integration with error handling
- Fault-tolerant design
- Comprehensive logging
- Environment-based configuration
- Security best practices

### Documentation
- README.md - Complete documentation
- QUICKSTART.md - 5-minute setup guide
- REQUIREMENTS.md - System requirements and setup
- CONTRIBUTING.md - Contribution guidelines
- .env.example - Configuration template
- install.py - Interactive installer
- start.sh - Quick start script
- systemd service example

### Security
- Environment variable based secrets
- Admin-only Telegram access
- No hardcoded credentials
- Secure session storage
- Input validation
- Error message sanitization

## [Unreleased]

### Planned
- Multi-operator support
- Conversation archiving
- Statistics and analytics
- Custom AI model selection
- Voice message transcription
- Scheduled messages
- Message templates
- Conversation backup/restore
- Web dashboard (optional)
- Database integration (optional)

### Under Consideration
- Multi-language support
- Custom command aliases
- Advanced media editing
- Group chat support
- Message scheduling
- Auto-response rules
- Integration with other platforms
- REST API for external control

---

## Version History

- **1.0.0** - Initial release with full feature set
