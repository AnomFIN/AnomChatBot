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

**Baileys (default)** — Connects via WhatsApp Web protocol. Scan a QR code on first launch (displayed in terminal and GUI). Session persists across restarts. If a login attempt gets stale, open **QR / WhatsApp** and click **Generoi QR uudelleen / Regenerate QR** to clear QR/login artifacts and request a fresh backend session. Unofficial — WhatsApp may change the protocol.

**Cloud API** — Official Meta API. Requires a Meta Business Account, webhook URL (use ngrok for development), and Cloud API credentials. Stable and supported.

## Admin GUI

The web interface runs at `http://127.0.0.1:3001` and provides:

- **Dashboard** — Transport status, AI status, system health
- **Conversations** — List, search, view messages, send replies
- **Settings** — Per-conversation tone, flirt, temperature, system prompt, auto-reply toggle
- **QR Code** — Baileys QR display with stale-state cleanup and manual regeneration
- **Logs** — Real-time server log stream with Socket.IO updates and polling fallback

No Telegram bot is required to use the GUI.

## QR login and live logs verification

1. Start the app with `start.bat` on Windows or `npm start` on Linux/macOS.
2. Open `http://127.0.0.1:3001` and go to **QR / WhatsApp**.
3. Click **Generoi QR uudelleen / Regenerate QR**. The UI should show a generating state, clear stale browser QR/login keys, call the backend reset endpoint, and then display the next Baileys QR event.
4. Go to **Logs**. Recent backend log entries should load immediately from `/api/logs`, then update live through Socket.IO while polling every five seconds as a fallback.

### Why this design

- QR regeneration has one backend authority: the Baileys transport closes the current socket, removes only its configured auth directory, and reconnects for a fresh QR.
- Browser cleanup targets QR/login/auth/session-style keys only, preserving unrelated user settings such as sidebar preferences.
- Live logs use an in-memory, redacted ring buffer plus Socket.IO emission, so the UI can recover after refresh without requiring a separate log database.
- `start.bat` keeps the original single-process startup behavior while adding readable sections and clear failure instructions.

### Troubleshooting

- If QR regeneration fails, check **Logs** or `GET /api/logs` for the backend error and confirm `WHATSAPP_MODE=baileys`.
- If the Logs page is empty, call `GET /api/health` or trigger QR regeneration to produce backend log events.
- If `start.bat` exits immediately, run `install.bat`, validate `.env`, and check the final error section printed by the launcher.

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
| GET | `/api/logs` | Recent backend logs for the live logs page |
| POST | `/api/transport/qr/regenerate` | Clear Baileys login artifacts and request a fresh QR |
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
LOCAL_AI_MCP_MODE=disabled
LOCAL_AI_MCP_CONFIG_PATH=.mcp.json
LOCAL_AI_MCP_INTEGRATIONS=[]
```

Runtime settings are also available in **System → Global Settings → Local AI / LM Studio**:

1. Start LM Studio and load a model.
2. Enable the LM Studio local server on `http://127.0.0.1:1234/v1`.
3. Enable Local AI in the GUI.
4. Set the exact model id shown by LM Studio.
5. Choose an MCP Mode if tools are needed.
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
| Ephemeral MCP | Uses LM Studio’s OpenAI-compatible `/v1/chat/completions` endpoint and adds ephemeral MCP `integrations` to the request body. |

#### Local MCP Config mode

Set **MCP Mode → Local MCP Config (.mcp.json)** and provide **MCP config path** such as `.mcp.json`. This preserves the existing configuration flow and does not replace Local AI.

#### Ephemeral MCP mode

Set **MCP Mode → Ephemeral MCP**, then add one or more integrations in the card-based GUI:

- **MCP Server Label** — e.g. `huggingface`
- **MCP Server URL** — e.g. `https://huggingface.co/mcp`
- **Allowed Tools** — comma-separated tools, e.g. `model_search`

The app validates every integration before saving:

- `server_url` must be a valid `http` or `https` URL.
- `allowed_tools` must contain at least one tool.
- empty labels, URLs, and tools are rejected.
- duplicate integrations with the same label and URL are rejected.

When Ephemeral MCP mode has at least one valid integration, Local AI requests go to:

```text
http://localhost:1234/v1/chat/completions
```

and include:

```json
{
  "integrations": [
    {
      "type": "ephemeral_mcp",
      "server_label": "huggingface",
      "server_url": "https://huggingface.co/mcp",
      "allowed_tools": ["model_search"]
    }
  ]
}
```

If MCP is disabled or the integration list is empty, the app falls back to the existing Local AI request path.

#### Example curl

```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "ibm/granite-4-micro",
    "messages": [
      {
        "role": "user",
        "content": "What is the top trending model on Hugging Face?"
      }
    ],
    "integrations": [
      {
        "type": "ephemeral_mcp",
        "server_label": "huggingface",
        "server_url": "https://huggingface.co/mcp",
        "allowed_tools": ["model_search"]
      }
    ]
  }'
```

### Why this design

- OpenAI cloud and Local AI remain isolated, preventing Local AI tokens or MCP metadata from leaking to OpenAI.
- Existing Local AI behavior remains the default fallback, so disabling MCP is non-breaking.
- Ephemeral integrations are stored as JSON and normalized at the provider boundary for deterministic requests.
- GUI validation catches unsafe or broken integration data before runtime.

### TODO

- Add a live “test integration” button that calls LM Studio with a short prompt.
- Surface LM Studio `/v1/chat/completions` response metadata in the admin health view.
- Add import/export for reusable MCP integration presets.

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

## Outgoing AI Review Queue

When an AI reply is generated (global OpenAI-compatible provider or Local AI), it now enters a short operator-review queue before transport send. The queue is shown on the left side of the Conversations screen under **Messages outgoing:**.

Operator controls:

- **Live countdown** — shows seconds until the AI message is released to WhatsApp.
- **Pause / Resume** — freezes or restarts the timer for one outgoing message.
- **Edit** — automatically pauses that message, saves the revised text, and keeps it paused until resumed.
- **Delete** — cancels the outgoing send and marks the persisted assistant message as failed with an operator-delete reason.

### Why this design

- The review queue is in-memory and owned by the conversation orchestrator, so unsent AI text has one authoritative timer and no duplicated state.
- Socket.IO pushes queue changes live while `/api/outgoing` lets the GUI recover the current queue after reconnect.
- Edits update the persisted assistant message before send, keeping the conversation transcript aligned with what actually leaves the system.
- The countdown uses the configured presence/read/typing duration, then the transport send runs immediately after approval to avoid double-waiting.

### Runbook

```bash
npm install
cd web && npm install && npm run build && cd ..
npm test
npm start
```

Troubleshooting:

- If no message appears in **Messages outgoing:**, confirm auto-reply is enabled and the AI provider generated a reply without error.
- If a message disappears instantly, check the presence settings; disabled presence produces a near-zero review delay.
- If build fails with parse errors around `<<<<<<<`, run `git grep -n -E '^(<<<<<<<|=======|>>>>>>>)'` and remove unresolved merge conflict markers.

### Next iterations

- Add durable recovery for queued-but-unsent messages across server restarts.
- Add role-based GUI authentication before exposing the review controls beyond localhost.
- Add an optional global “require manual approve” mode that never auto-sends without operator release.
