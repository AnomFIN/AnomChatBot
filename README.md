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

## Local AI / LM Studio

Local AI is configured independently from OpenAI cloud. Enabling Local AI does **not** change `OPENAI_API_KEY`, and LM Studio permission tokens are never sent to OpenAI requests.

```env
LOCAL_AI_ENABLED=false
LOCAL_AI_PROVIDER=lmstudio
LOCAL_AI_BASE_URL=http://127.0.0.1:1234/v1
LOCAL_AI_MODEL=
LOCAL_AI_USE_PERMISSION_TOKEN=false
LOCAL_AI_PERMISSION_TOKEN=
LOCAL_AI_MCP_ENABLED=false
LOCAL_AI_MCP_CONFIG_PATH=.mcp.json
```

Runtime settings are also available in **System → Global Settings → Local AI / LM Studio**:

1. Start LM Studio and load a model.
2. Enable the LM Studio local server on `http://127.0.0.1:1234/v1`.
3. Enable Local AI in the GUI.
4. Set the exact model id shown by LM Studio.
5. Save settings and send a test message.

### LM Studio Permission Token

When **Use LM Studio Permission Token** is enabled and a token exists, Local AI requests include:

```http
Authorization: Bearer <LOCAL_AI_PERMISSION_TOKEN>
```

If the toggle is enabled but the token is empty, the server returns a clear auth error before calling LM Studio. If the toggle is disabled, no `Authorization` header is added. The token is redacted in the GUI and logs must never include it.

### MCP configuration status

The GUI stores:

- `LOCAL_AI_MCP_ENABLED`
- `LOCAL_AI_MCP_CONFIG_PATH` (default `.mcp.json`)

MCP is intentionally Local AI only. Current support is configuration-ready, not tool-execution-ready. A real MCP tool-call loop still needs:

1. receive model `tool_calls`
2. execute the MCP tool
3. append tool results back to the model context
4. request the final assistant answer

The app logs this as configured but not implemented instead of pretending `.mcp.json` alone makes tools work.

## Branding / Visual Settings

Open **System → Global Settings → Branding / Visual Settings** to upload premium UI branding:

- top bar logo: PNG, JPG/JPEG, WEBP, or SVG rendered through a safe `<img>` tag
- chat background image: PNG, JPG/JPEG, or WEBP
- max file size: 3MB
- reset buttons for logo and background
- live preview before saving

Chat backgrounds use `background-size: cover`, centered positioning, and a dark overlay/blur layer to keep messages readable.

## Generation cancellation and follow-up safety

Incoming user messages now cancel the active AI generation for that conversation, persist the new user message, rebuild the prompt from the latest full history window, and start a fresh generation. A per-conversation generation id plus `AbortController` ensures only the newest request can persist/send an assistant reply.

Autonomous follow-up messages are trimmed and validated. If the model returns empty content, the orchestrator creates a short fallback based on the latest user message instead of sending a blank message.

## Why this design

- OpenAI cloud and Local AI credentials remain separate by construction.
- Local AI uses `fetch` directly so the Authorization header can be omitted when LM Studio token mode is off.
- MCP settings are honest configuration, with the missing tool-call loop documented instead of mocked.
- Generation cancellation is scoped per conversation to avoid cross-chat interference.
- Branding is data-url based for local-first persistence without adding storage dependencies.

## Run commands

```bash
npm install
cd web && npm install && npm run build && cd ..
npm test
npm start
```

## Verification steps

1. Open `http://127.0.0.1:3001`.
2. Go to **System → Global Settings** and confirm cards for OpenAI, Local AI / LM Studio, MCP, Branding, and Advanced.
3. Enable Local AI without token and verify LM Studio receives no `Authorization` header.
4. Enable token mode without a token and verify the GUI/API shows a clear missing-token error.
5. Upload/reset logo and background; confirm the top bar logo keeps aspect ratio and the chat remains readable.
6. Send message A, then message B while the bot is thinking; only the newest AI response should be sent.

## Next iterations

- Implement the real MCP tool-call loop with tool result persistence and timeout controls.
- Add GUI authentication before exposing the admin panel outside localhost.
- Move large branding assets from settings rows to content-addressed local files if teams need bigger images.
