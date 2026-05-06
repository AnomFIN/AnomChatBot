# AnomChatBot

Human-controlled chatbot bridge: WhatsApp ↔ OpenAI / Local AI (LM Studio), with a React admin GUI and optional Telegram admin controls.

## Features

- **React Admin GUI** at `http://127.0.0.1:3001` — manage conversations, settings, and monitor status in real-time
- **WhatsApp Integration** — Cloud API (production) or Baileys (unofficial, QR-based)
- **AI Responses** — OpenAI GPT or any OpenAI-compatible endpoint (LM Studio, Ollama)
- **Local AI / LM Studio** — dedicated Local AI config path, completely isolated from the OpenAI cloud path
- **Generation Cancellation** — in-flight AI requests are aborted when a newer message arrives; no race conditions
- **First-message rule** — operator always sends the first message manually
- **Per-conversation settings** — system prompt, tone, flirt level, temperature, max tokens
- **Branding** — upload a custom top-bar logo and chat background image via the GUI
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

## Local AI / LM Studio

AnomChatBot has a fully isolated Local AI path. When enabled, it takes priority over all OpenAI cloud settings.

### Environment variables

```ini
LOCAL_AI_ENABLED=false
LOCAL_AI_PROVIDER=lmstudio
LOCAL_AI_BASE_URL=http://127.0.0.1:1234/v1
LOCAL_AI_MODEL=
LOCAL_AI_USE_PERMISSION_TOKEN=false
LOCAL_AI_PERMISSION_TOKEN=
LOCAL_AI_MCP_ENABLED=false         # experimental — config only, not yet active
LOCAL_AI_MCP_CONFIG_PATH=.mcp.json
```

### Authorization header behavior

| Scenario | HTTP behavior |
|---|---|
| `LOCAL_AI_USE_PERMISSION_TOKEN=false` (or empty token) | **No `Authorization` header sent** — no dummy credential is ever transmitted |
| `LOCAL_AI_USE_PERMISSION_TOKEN=true` + token set | `Authorization: Bearer <token>` sent |
| OpenAI cloud path | Unchanged — uses `OPENAI_API_KEY` normally |

The Local AI provider uses a custom `fetch` wrapper to strip the `Authorization` header entirely when no permission token is configured. A dummy API key is required internally by the OpenAI SDK constructor but is **never sent over the network**.

### LM Studio setup

1. Start LM Studio and load a model
2. Enable the local server (default: `http://127.0.0.1:1234/v1`)
3. Optionally enable "Use Permission Token" in LM Studio server settings
4. In AnomChatBot, go to **System → Global Settings → Local AI / LM Studio Settings**:
   - Enable Local AI
   - Set Base URL to `http://127.0.0.1:1234/v1`
   - Set the model identifier (copy from LM Studio)
   - If LM Studio token auth is on, enable "Use Permission Token" and paste the token

### MCP (Model Context Protocol) status

> **Experimental — configuration only.**

The MCP toggle and config path fields are visible in the GUI but are **not yet active**. Enabling MCP in the GUI saves the configuration for future use; no tool-call loop is currently implemented. The GUI clearly labels these fields as "coming soon".

A full MCP implementation requires:
1. Tool call receipt (`tool_calls` in assistant response)
2. MCP tool execution via the config path
3. Tool results sent back to the model
4. Final response generation

## Generation Cancellation

When a user sends a new message before the AI finishes replying to a previous message:

1. The pending delay timer is reset (multi-message batching)
2. Any **in-flight AI HTTP request** is aborted via `AbortController` — no partial or stale responses are ever sent
3. A new generation starts with the full updated context (all messages up to and including the latest)

This prevents race conditions where an older response would overwrite a newer context. The implementation uses the OpenAI SDK's native `signal` option, so the cancellation happens at the HTTP level.

## Autonomous Follow-up (AI Approach)

When the AI approach feature is enabled and the AI returns an empty or whitespace-only response:
- The message is **not persisted** to the database
- The message is **not sent** to the user
- The approach tracking state is updated to prevent repeated empty sends

This guarantees that empty responses never appear in the conversation history or reach end users.

## Branding / Visual Settings

Upload a custom logo and background image via **System → Branding / Visual Settings**:

| Setting | Allowed formats | Max size |
|---|---|---|
| Top bar logo | PNG, JPG, WEBP, SVG | 5 MB |
| Chat background | PNG, JPG, WEBP | 5 MB |

Files are validated (type + size) on both the frontend and backend before upload. Uploaded files are served at `/branding/logo.*` and `/branding/bg.*`. Use the **Reset** buttons to remove the current image. The logo appears in the top status bar; the background image is applied as a `cover` background behind the chat message area.

## Admin GUI

The web interface runs at `http://127.0.0.1:3001` and provides:

- **Dashboard** — Transport status, AI status, system health
- **Conversations** — List, search, view messages, send replies
- **Settings** — Per-conversation tone, flirt, temperature, system prompt, auto-reply toggle
- **System** — Global settings (AI provider override, Local AI / LM Studio, reply delay, presence simulation, branding)
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
| GET | `/api/settings` | Global settings |
| PUT | `/api/settings` | Update global settings |
| GET | `/api/settings/branding` | Get branding paths |
| POST | `/api/settings/branding/logo` | Upload top-bar logo (multipart) |
| DELETE | `/api/settings/branding/logo` | Reset logo |
| POST | `/api/settings/branding/background` | Upload chat background (multipart) |
| DELETE | `/api/settings/branding/background` | Reset background |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full details.

```
src/
├── config/           # .env loading, validation
├── transport/        # WhatsApp Cloud API + Baileys adapters
├── ai/               # OpenAI provider abstraction (with omitAuth + AbortSignal support)
├── conversation/     # Orchestrator, prompt builder, first-message rule
├── persistence/      # SQLite (better-sqlite3), schema, CRUD
├── api/              # Fastify HTTP routes (conversations, settings, branding, health)
├── realtime/         # Socket.IO event broadcasting
└── admin/            # Telegram admin bot

web/                  # React 18 + Vite frontend
├── src/components/   # StatusBar, ConversationList, ConversationView, GlobalSettings, etc.
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
| AI | OpenAI SDK (cloud + local AI with omitAuth) |
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
- **MCP** — configuration fields exist in the GUI but no server-side MCP tool-call loop is implemented yet.

## License

MIT
