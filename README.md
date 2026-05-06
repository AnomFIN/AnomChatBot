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
LOCAL_AI_ENABLED=true
LOCAL_AI_PROVIDER=lmstudio
LOCAL_AI_BASE_URL=http://10.5.0.2:1234/v1
LOCAL_AI_MODEL=qwen3-coder-next
LOCAL_AI_USE_PERMISSION_TOKEN=false
LOCAL_AI_PERMISSION_TOKEN=
WEB_SEARCH_ENABLED=true
WEB_SEARCH_PROVIDER=brave
LOCAL_AI_MCP_MODE=ephemeral
LOCAL_AI_MCP_CONFIG_PATH=.mcp.json
LOCAL_AI_MCP_INTEGRATIONS=[{"type":"ephemeral_mcp","server_label":"brave-search","server_url":"http://10.5.0.2:8000/mcp","allowed_tools":["brave_web_search","brave_local_search","brave_news_search"]},{"type":"ephemeral_mcp","server_label":"huggingface","server_url":"https://huggingface.co/mcp","allowed_tools":["hub_repo_search","hub_repo_details","paper_search","hf_doc_search","hf_doc_fetch"]}]
```

Runtime settings are also available in **System → Global Settings → Local AI / LM Studio**:

1. Start LM Studio and load a model.
2. Enable the LM Studio local server on `http://10.5.0.2:1234/v1` (or change the base URL if LM Studio is elsewhere).
3. Confirm Local AI is enabled; it is ON by default.
4. Confirm the default model `qwen3-coder-next` or set the exact loaded model id shown by LM Studio.
5. Keep Ephemeral MCP enabled for routed web/HuggingFace tools, or disable MCP for plain local chat.
6. Save settings and send a test message.

### LM Studio Permission Token

When **Use LM Studio Permission Token** is enabled and a token exists, Local AI requests include:

```http
Authorization: Bearer <LOCAL_AI_PERMISSION_TOKEN>
```

If the toggle is enabled but the token is empty, the server returns a clear auth error before calling LM Studio. If the toggle is disabled, no `Authorization` header is added. The token is redacted in the GUI and logs must never include it.

### MCP modes

MCP is **Local AI / LM Studio only**. OpenAI cloud continues to use the OpenAI SDK path and never receives `integrations`.

| Mode | Behavior |
|---|---|
| Disabled | Uses the existing Local AI `/v1/chat/completions` request path. |
| Local MCP Config (`.mcp.json`) | Keeps the existing local MCP config path behavior for compatibility. |
| Ephemeral MCP | Uses LM Studio API `/api/v1/chat` with serialized `input` plus ephemeral MCP `integrations`. |

#### Local MCP Config mode

Set **MCP Mode → Local MCP Config (.mcp.json)** and provide **MCP config path** such as `.mcp.json`. This preserves the existing configuration flow and does not replace Local AI.

#### Ephemeral MCP mode

Set **MCP Mode → Ephemeral MCP**, then add one or more integrations in the card-based GUI:

- **MCP Server Label** — e.g. `brave-search` or `huggingface`
- **MCP Server URL** — e.g. `http://10.5.0.2:8000/mcp` for a local Brave MCP HTTP server, or `https://huggingface.co/mcp`
- **Allowed Tools** — comma-separated tools, e.g. `brave_web_search, brave_local_search, brave_news_search`

The app validates every integration before saving:

- `server_url` must be a valid `http` or `https` URL.
- `allowed_tools` must contain at least one tool.
- empty labels, URLs, and tools are rejected.
- duplicate integrations with the same label and URL are rejected.

Normal Local AI chat uses:

- endpoint: `/v1/chat/completions`
- payload: OpenAI-compatible `messages[]`

By default Ephemeral MCP has two routed integrations:

1. **General Web Search** — Brave Search MCP (`brave-search`) for news, companies, sports, current events, websites, prices, trends and general facts. Brave is selected because the official Brave MCP server supports HTTP transport and has web/local/news tools. DuckDuckGo can be selected in the GUI as a fallback provider.
2. **HuggingFace MCP** — `huggingface` for AI/ML resources only: models, datasets, Spaces, papers and Hugging Face docs. HuggingFace MCP is **not** a general web search engine.

Tool routing is intentionally conservative: web/current/company/sports/people/price queries route to web search first; HuggingFace only receives AI/ML/model/dataset/paper/docs intents. Raw tool traces and search JSON are not serialized back into the model history—only user text and final assistant text are kept.

When Ephemeral MCP mode is enabled, Local AI requests go to:

```text
http://localhost:1234/api/v1/chat
```

and use `input` plus `integrations`:

```json
{
  "model": "qwen3-coder-next",
  "input": "What is the top trending model on hugging face?",
  "integrations": [
    {
      "type": "ephemeral_mcp",
      "server_label": "brave-search",
      "server_url": "http://10.5.0.2:8000/mcp",
      "allowed_tools": ["brave_web_search", "brave_local_search", "brave_news_search"]
    }
  ]
}
```

If MCP is disabled or Local MCP Config mode is selected, the app uses the existing OpenAI-compatible Local AI request path.

#### Example curl

```bash
curl http://localhost:1234/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen3-coder-next",
    "input": "What is the top trending model on hugging face?",
    "integrations": [
      {
        "type": "ephemeral_mcp",
        "server_label": "brave-search",
        "server_url": "http://10.5.0.2:8000/mcp",
        "allowed_tools": [
          "brave_web_search",
          "brave_local_search",
          "brave_news_search"
        ]
      }
    ]
  }'
```

### Why this design

- OpenAI cloud and Local AI remain isolated, preventing Local AI tokens or MCP metadata from leaking to OpenAI.
- Normal Local AI stays on `/v1/chat/completions`; only Ephemeral MCP branches to `/api/v1/chat`.
- Ephemeral integrations are stored as JSON and serialized into LM Studio's `input` + `integrations` API shape at the provider boundary.
- The provider parses LM Studio `/api/v1/chat` output arrays and only returns final `message.content`; `tool_call` JSON is never sent to users.
- Brave/DDG handles general internet search, while HuggingFace is scoped to AI-specific resources only.
- GUI validation catches unsafe or broken integration data before runtime.

### TODO

- Add a live “test integration” button that calls LM Studio with a short prompt.
- Surface LM Studio `/api/v1/chat` response metadata in the admin health view.
- Add import/export for reusable MCP integration presets.
- Add a one-click Brave MCP local launcher/check once deployment packaging is finalized.
- Add provider-specific health checks for Brave/DDG MCP endpoints.

## Branding / Visual Settings

Open **System → Global Settings → Branding / Visual Settings** to upload premium UI branding:

- top bar logo: PNG, JPG/JPEG, WEBP, or SVG rendered through a safe `<img>` tag
- chat background image: PNG, JPG/JPEG, or WEBP
- max file size: 3MB for logos, 5MB for chat backgrounds
- explicit Choose file → preview → Apply flow
- reset buttons for logo and background
- persisted in the existing SQLite-backed settings API (`branding_top_bar_logo`, `branding_chat_background`)

The top bar logo renders directly as an `<img class="topbar-logo">` in the status bar. Chat backgrounds render as a stable `.chat-background-layer` under `.chat-content`, with a dark overlay layer above the image so messages remain readable across scrolls and rerenders.

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
5. Choose a logo file, confirm the filename/preview, click Apply, refresh, and confirm the top bar logo still renders.
6. Choose a background file, confirm the filename/preview, click Apply, refresh, and confirm the chat background layer remains visible while scrolling.
7. Try an oversized logo/background or unsupported file type and confirm the API/GUI rejects it clearly.
8. Send message A, then message B while the bot is thinking; only the newest AI response should be sent.

## Next iterations

- Implement the real MCP tool-call loop with tool result persistence and timeout controls.
- Add GUI authentication before exposing the admin panel outside localhost.
- Move large branding assets from settings rows to content-addressed local files if teams need bigger images.
