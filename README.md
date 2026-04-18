# AnomChatBot

Human-controlled chatbot bridge: WhatsApp ↔ OpenAI, with a React admin GUI and optional Telegram admin controls.

## Features

- **React Admin GUI** at `http://127.0.0.1:3001` — manage conversations, settings, and monitor status in real-time
- **WhatsApp Integration** — Cloud API (production) or Baileys (unofficial, QR-based)
- **AI Responses** — OpenAI GPT or any OpenAI-compatible endpoint (LM Studio, Ollama)
- **First-message rule** — operator always sends the first message manually
- **Per-conversation settings** — system prompt, tone, flirt level, temperature, max tokens
- **Real-time updates** — Socket.IO for instant message notifications and status changes
- **Telegram admin** (optional) — `/status`, `/list`, `/stats` commands from Telegram
- **SQLite persistence** — conversations, messages, and settings survive restarts
- **Windows-first** — `install.bat` and `start.bat` for easy Windows setup

## Requirements

- **Node.js 20+** ([download](https://nodejs.org/))
- **OpenAI API key** (or OpenAI-compatible local endpoint)
- One of:
  - WhatsApp Business Cloud API credentials (recommended for production)
  - A phone number for Baileys QR login (unofficial, for development/personal use)

## Quick Start

### Windows

```
git clone https://github.com/AnomFIN/AnomChatBot.git
cd AnomChatBot
install.bat
```

Edit `.env` with your API keys, then:

```
start.bat
```

### Linux / macOS

```bash
git clone https://github.com/AnomFIN/AnomChatBot.git
cd AnomChatBot
npm install
cd web && npm install && npm run build && cd ..
cp .env.example .env
# Edit .env with your keys
npm start
```

Open **http://127.0.0.1:3001** in your browser.

## Configuration

All settings are in `.env` (copied from `.env.example` during install). Key values:

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI API key (or compatible) |
| `OPENAI_MODEL` | No | Model name (default: `gpt-4o-mini`) |
| `OPENAI_BASE_URL` | No | Override for local endpoints |
| `WHATSAPP_MODE` | No | `cloud_api` or `baileys` (default: `baileys`) |
| `TELEGRAM_ENABLED` | No | `true` to enable Telegram admin (default: `false`) |
| `PORT` | No | Server port (default: `3001`) |

See [.env.example](.env.example) for all options.

### WhatsApp Modes

**Baileys (default)** — Connects via WhatsApp Web protocol. Scan a QR code on first launch (displayed in terminal and GUI). Session persists across restarts. Unofficial — WhatsApp may change the protocol.

**Cloud API** — Official Meta API. Requires a Meta Business Account, webhook URL (use ngrok for development), and Cloud API credentials. Stable and supported.

## Admin GUI

The web interface runs at `http://127.0.0.1:3001` and provides:

- **Dashboard** — Transport status, AI status, system health
- **Conversations** — List, search, view messages, send replies
- **Settings** — Per-conversation tone, flirt, temperature, system prompt, auto-reply toggle
- **QR Code** — Baileys QR display for WhatsApp login
- **Logs** — Real-time server log stream

No Telegram bot is required to use the GUI.

## Telegram Admin (Optional)

Set `TELEGRAM_ENABLED=true` and provide `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ADMIN_IDS` in `.env`.

| Command | Action |
|---|---|
| `/start` | Welcome + command list |
| `/status` | System health overview |
| `/list` | Active conversations |
| `/stats` | Message counts |
| `/help` | Command reference |

## API Endpoints

All return `{ success, data?, error? }`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | System health + transport status |
| GET | `/api/conversations` | List conversations |
| GET | `/api/conversations/:id/messages` | Message history |
| POST | `/api/conversations/:id/messages` | Send a message |
| GET | `/api/conversations/:id/settings` | Conversation settings |
| PUT | `/api/conversations/:id/settings` | Update settings |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full details.

```
src/
├── config/           # .env loading, validation
├── transport/        # WhatsApp Cloud API + Baileys adapters
├── ai/               # OpenAI provider abstraction
├── conversation/     # Orchestrator, prompt builder, first-message rule
├── persistence/      # SQLite (better-sqlite3), schema, CRUD
├── api/              # Fastify HTTP routes
├── realtime/         # Socket.IO event broadcasting
└── admin/            # Telegram admin bot

web/                  # React 18 + Vite frontend
├── src/components/   # StatusBar, ConversationList, ConversationView, etc.
├── src/hooks/        # useSocket, useConversations, useStatus
├── src/context/      # SocketContext provider
└── src/api/          # Fetch wrapper for backend API
```

## Tech Stack

| Component | Technology |
|---|---|
| Runtime | Node.js 20+ (ESM) |
| HTTP Server | Fastify 5 |
| WebSocket | Socket.IO 4 |
| WhatsApp | @whiskeysockets/baileys / Cloud API |
| AI | OpenAI SDK |
| Database | better-sqlite3 (SQLite, WAL mode) |
| Frontend | React 18 + Vite |
| Logging | pino + pino-pretty |

## Testing

```bash
npm test           # Run all tests (vitest)
npm run test:watch # Watch mode
```

See [MANUAL_TESTING.md](MANUAL_TESTING.md) for transport and GUI verification procedures.

## Limitations

- **Baileys** is unofficial. WhatsApp can break it without notice. Use Cloud API for production.
- **No GUI authentication.** Binds to `127.0.0.1` by default. Do not expose to the internet without adding auth.
- **SQLite** is single-writer. Fine for a single-instance chatbot.
- **Telegram admin** is optional and not required for any core functionality.

## License

MIT
