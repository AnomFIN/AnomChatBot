# AnomChatBot — Architecture

Unified Node.js 20+ chatbot bridge: WhatsApp ↔ Telegram ↔ OpenAI, with a React admin GUI.

---

## System Overview

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  WhatsApp    │◄───►│                  │◄───►│  Telegram Admin  │
│  (Cloud/     │     │   Conversation   │     │  (optional)      │
│   Baileys)   │     │   Orchestrator   │     └─────────────────┘
└─────────────┘     │                  │
                     │   ┌──────────┐  │     ┌─────────────────┐
                     │   │ AI Engine│  │◄───►│  React GUI       │
                     │   └──────────┘  │     │  (Fastify +      │
                     │                  │     │   Socket.IO)     │
                     └────────┬─────────┘     └─────────────────┘
                              │
                     ┌────────▼─────────┐
                     │  SQLite (WAL)    │
                     │  better-sqlite3  │
                     └──────────────────┘
```

## Layered Directory Structure

```
src/
├── config/           # .env loading, validation, frozen config export
├── transport/        # WhatsApp (Cloud API + Baileys) adapters
├── ai/               # OpenAI / OpenAI-compatible provider abstraction
├── conversation/     # Conversation state, prompt assembly, first-message rule
├── persistence/      # SQLite via better-sqlite3 — schema, migrations, CRUD
├── api/              # Fastify HTTP routes (conversations, settings, health, webhook)
├── realtime/         # Socket.IO event broadcasting
└── admin/            # Telegram admin bot (optional, polling-based)

web/                  # React GUI (Vite + React 18)
├── src/
│   ├── App.jsx       # Main app with tab navigation (Conversations/System/QR/Logs)
│   ├── components/   # StatusBar, ConversationList, ConversationView, SettingsPanel,
│   │                 #   GlobalSettings, QRCodeDisplay, LogsView, MessageBubble
│   ├── hooks/        # useSocket, useConversations, useStatus, useQRCode
│   ├── context/      # SocketContext provider (Socket.IO connection management)
│   └── api/          # Fetch wrapper for Fastify endpoints
├── index.html
├── vite.config.js    # Dev proxy to localhost:3001 for /api and /socket.io
└── package.json
```

### GUI Serving

In production, `web/dist/` (Vite build output) is served by Fastify via `@fastify/static`. A SPA fallback routes non-API requests to `index.html`. In development, Vite's dev server proxies `/api` and `/socket.io` to the Fastify backend.

## Key Design Decisions

### Transport Abstraction

All transports implement a common interface:

```
initialize()          → Start the transport
sendMessage(to, content, options) → Send a message
shutdown()            → Clean disconnect
getStatus()           → { status, details }
on(event, handler)    → 'message' | 'status_change'
```

WhatsApp mode is selected via `WHATSAPP_MODE` env var:

| Value   | Transport              | Notes                                    |
|---------|------------------------|------------------------------------------|
| `cloud` | WhatsApp Cloud API     | Official Meta API, webhook-based          |
| `baileys` | Baileys (WA Web)    | Unofficial, QR-based, first-class support |

Both receive equal engineering quality. Cloud API is the stable production recommendation; Baileys is clearly documented as unofficial.

### AI Provider

OpenAI SDK client with configurable base URL for OpenAI-compatible local endpoints (LM Studio, Ollama, etc.):

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=              # Override for local endpoints
OPENAI_MODEL=gpt-4o-mini      # Default model
```

Provider interface:

```
generateReply(messages, options) → { content, tokenUsage }
testConnection()                 → { success, model, error? }
getStatus()                      → { connected, model, provider }
```

### Conversation Orchestrator

Central service. Transports feed messages in → orchestrator routes through AI → responses go back out through the same transport.

**First-message rule**: The first message in any new conversation MUST be written manually by the operator. AI auto-reply is only enabled after the operator sends that initial message.

### Canonical Enum Values

**Tone** (per-conversation setting):
- `professional`
- `friendly`
- `casual`
- `playful`

**Flirt Level** (per-conversation setting):
- `none`
- `subtle`
- `moderate`
- `high`

These are stored as string enums in the database, not floats.

### Persistence

SQLite via `better-sqlite3` (synchronous, no async complexity).

- WAL mode for concurrent read/write
- Foreign keys enforced
- Migrations run at startup (CREATE TABLE IF NOT EXISTS)
- Data directory: `./data/`
- Database file: `./data/anomchatbot.db`

Tables: `conversations`, `messages`, `admin_logs`, `transport_status`

### Real-Time Events (Socket.IO)

```
Server → Client:
  status:update         { whatsapp, telegram, ai, system }
  conversation:new      { conversation }
  conversation:update   { conversation }
  message:new           { conversationId, message }
  message:status        { messageId, status }
  transport:qr          { qrDataUrl }
  log:entry             { level, message, timestamp }

Client → Server:
  message:send          { conversationId, text }
  conversation:settings { conversationId, settings }
```

### API Endpoints (Fastify)

All endpoints return `{ success: boolean, data?: any, error?: string }`.

| Method | Path                              | Purpose                      |
|--------|-----------------------------------|------------------------------|
| GET    | /api/health                       | Transport + AI status        |
| GET    | /api/conversations                | List conversations           |
| GET    | /api/conversations/:id/messages   | Conversation message history |
| POST   | /api/conversations/:id/messages   | Send message                 |
| GET    | /api/settings                     | Global settings              |
| PUT    | /api/settings                     | Update settings              |
| GET    | /api/status                       | Full system snapshot for GUI |

### Telegram Admin Commands

Optional — enabled only when `TELEGRAM_ENABLED=true` and `TELEGRAM_BOT_TOKEN` is configured. Uses `node-telegram-bot-api` with polling (not webhooks). Admin-only: all commands gated by `TELEGRAM_ADMIN_IDS`.

| Command  | Action                              |
|----------|-------------------------------------|
| `/start` | Welcome + command list               |
| `/status`| System health overview               |
| `/list`  | Active conversations + last message  |
| `/stats` | Message counts                       |
| `/help`  | Command reference                    |

The Telegram admin reads the same database and service state as the Web GUI. It is NOT a user-facing transport — it's an admin control channel only.

### Startup Sequence

1. Load and validate config (.env)
2. Create Fastify server (pino logger)
3. Initialize SQLite (run migrations)
4. Initialize Socket.IO
5. Initialize AI provider (test connection)
6. Create conversation orchestrator
7. Initialize WhatsApp transport (Cloud API or Baileys)
8. Register HTTP routes (health, conversations, settings, webhook)
9. Initialize Telegram admin (if enabled)
10. Register graceful shutdown handlers
11. Start listening on configured host:port
12. Serve React GUI from `web/dist/` (if built)

### Graceful Shutdown

SIGINT/SIGTERM → close transports → flush database → close Fastify → exit.

### Error Boundaries

Each transport initializes independently. One transport failure does not crash the system. Errors are surfaced to the GUI with classification: `auth_error`, `rate_limit`, `network`, `provider_error`.

---

## Technology Stack

| Component       | Technology                          |
|-----------------|-------------------------------------|
| Runtime         | Node.js 20+ (ESM)                   |
| HTTP server     | Fastify 5 + @fastify/static          |
| WebSocket       | Socket.IO 4                          |
| WhatsApp        | @whiskeysockets/baileys / Cloud API  |
| Telegram        | node-telegram-bot-api (admin only)   |
| AI              | openai SDK                           |
| Database        | better-sqlite3                       |
| Frontend        | React 18 + Vite 6                    |
| Logging         | pino + pino-pretty                   |
| Testing         | vitest                               |
| Process         | Windows-first (install.bat, start.bat) |

---

## Security

- No hardcoded secrets — all sensitive data in `.env`
- Admin-only Telegram commands (verified by `TELEGRAM_ADMIN_IDS`)
- No secrets in logs, UI, or error messages
- `.env` excluded from version control
- Database local only (no cloud sync)
- Fastify JSON schema validation on all API inputs
