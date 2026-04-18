# Legacy Extraction Summary

Pre-deletion reference document. Created before any legacy code is removed.
Captures all useful behavior, patterns, and design decisions from the old codebase.

---

## Node.js Files — Archived to `_legacy/` for Active Reference

These files are moved to `_legacy/` and remain available during implementation.
They will be deleted in Phase 12 after all replacement code is verified.

### `index.js` (385 LOC) — App Orchestration

**Useful patterns:**
- `AnomChatBot` class wiring: WhatsApp callbacks → ConversationManager → AI → Telegram
- `validateEnvironment()`: checks `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_ID` with clear error
- `ensureDirectories()`: creates `logs/` and `.wwebjs_auth/` with `recursive: true` and `mode: 0o700`
- `handleWhatsAppMessage()` full flow:
  1. Get contact name from message
  2. Get-or-create conversation
  3. Process media if present (download → describe via AI)
  4. Add to conversation history
  5. Forward to Telegram admin
  6. If `aiEnabled && firstMessageSent` → generate AI response
- `handleManualResponse()`: operator sends via Telegram reply → WhatsApp send → mark firstMessageSent → enable AI
- `generateAIResponse()`: get history → build system prompt with tone/flirt → AI generate → send to WhatsApp + Telegram
- Graceful shutdown: SIGINT/SIGTERM handlers close WhatsApp, stop Telegram polling
- `process.on('unhandledRejection')` and `process.on('uncaughtException')` global handlers

### `src/bridges/WhatsAppBridge.js` (331 LOC) — Baileys WhatsApp Transport

**Useful patterns:**
- `makeWASocket` config: `auth: state`, `printQRInTerminal: false`, `browser: ['AnomChatBot', 'Chrome', '1.0.0']`, `defaultQueryTimeoutMs: 60000`, pino logger at `warn` level
- `useMultiFileAuthState(this.authDir)` for session persistence in `./data/whatsapp_session`
- `connection.update` event handler:
  - `qr` field: generate QR via `qrcode.generate(qr, { small: true })`
  - `connection === 'close'`: check `lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut` for reconnect decision
  - Reconnect counter: `reconnectAttempts` up to `maxReconnectAttempts` (5), 5s delay between attempts
  - `connection === 'open'`: reset counter, set `ready = true`
- `creds.update` → `saveCreds` for auth persistence
- `messages.upsert` handler: filter `!message.key.fromMe && message.message`, then `handleIncomingMessage()`
- `handleIncomingMessage()`:
  - `getContentType(message.message)` switch: `conversation`, `extendedTextMessage`, `imageMessage`, `videoMessage`, `audioMessage`, `documentMessage`
  - Extract caption from image/video messages
  - JID decoding: `jidDecode(fromJid)?.user`, `isJidGroup()` for group detection, participant extraction
  - Construct normalized message object: `{ id, from, author, body, hasMedia, type, timestamp, isGroupMsg, chat }`
- `sendMessage(chatId, message)`: `this.socket.sendMessage(chatId, { text: message })`, returns `{ success, messageId }`
- `downloadMedia(message)`: `downloadMediaMessage(message, 'buffer', {})` with reupload request
- `close()`: `this.socket?.end()`, error-safe

### `src/bridges/TelegramController.js` (457 LOC) — Telegram Admin Bot

**Useful patterns:**
- `node-telegram-bot-api` with `{ polling: true }`
- Admin check: `this.isAdmin(msg.from.id)` comparing against single `adminId`
- `conversationMapping`: `Map<telegramMessageId, whatsappChatId>` for reply-to tracking (limited to 1000 entries)
- Command handlers via `this.bot.onText(/\/command/, handler)`:
  - `/start`: welcome + command list
  - `/status`: calls `this.onGetStatus()` callback
  - `/conversations`: calls `this.onListConversations()` callback
  - `/help`: detailed usage guide with Markdown (+ plain text fallback)
  - `/ai [system_prompt]`: requires reply-to a forwarded message, maps to WhatsApp chat, enables AI
  - `/stop_ai`: disables AI via reply-to mapping
- Generic message handler: if replying to a mapped message → `this.onManualResponse(whatsappChatId, msg.text)`
- `forwardMessage()`: formats metadata (contact, timestamp, hasMedia, mediaType) into Markdown, sends with parse_mode, falls back to plain text on Markdown error
- `escapeMarkdown()`: escapes `*_`[]()\\` for Telegram classic Markdown
- `sendStatusUpdate()`: formatted status with emoji indicators
- `sendConversationsList()`: inline keyboard buttons per conversation
- Error handling: every command wrapped in try/catch with fallback error message to user
- `polling_error` event handler

### `src/managers/AIEngine.js` (141 LOC) — OpenAI Integration

**Useful patterns:**
- `new OpenAI({ apiKey })` client init
- `initialize()`: test connection via `this.client.models.list()` — simple and effective
- `generateResponse(messages, settings)`:
  - Destructure `aiAggressiveness` from settings (default 0.5)
  - Temperature calculated: `0.7 + (aiAggressiveness * 0.3)`
  - `chat.completions.create` with: model `gpt-4-turbo-preview`, presence_penalty 0.6, frequency_penalty 0.3, max_tokens 500
  - Extract `response.choices[0]?.message?.content`
  - Throw on empty response
  - Special handling for 429 (rate limit) with user-friendly message
- `analyzeMedia(mediaUrl, mediaType, context)`:
  - Image: `gpt-4-vision-preview` with `[{ type: 'text', text }, { type: 'image_url', image_url: { url } }]`
  - Other types: return placeholder `Received ${mediaType}`
- `getStatus()`: `{ connected, lastError, model }`

### `src/managers/ConversationManager.js` (170 LOC) — In-Memory Conversations

**Useful patterns:**
- `Map<chatId, conversation>` storage
- Auto-create on `getConversation()` with defaults:
  - `aiEnabled: false`, `systemPrompt: null`, `firstMessageSent: false`
  - `settings: { flirtLevel: 0.5, tone: 'friendly', responseSpeed: 'normal', aiAggressiveness: 0.5 }`
  - `metadata: { createdAt, lastActivity, messageCount: 0 }`
- `addMessage()`: push to history, update lastActivity + messageCount, cap at 100 messages
- `setSystemPrompt()`: also sets `firstMessageSent = true`
- `getHistoryForAI(chatId, maxMessages=20)`: prepend system prompt, then slice recent history
- `getActiveConversations()`: filter active, sort by lastActivity desc
- `getConversationSummary()`: compact view with last message preview (50 char)
- `clearHistory()` and `deleteConversation()` operations

### `src/handlers/MediaHandler.js` (110 LOC) — Media Processing

**Useful patterns:**
- `processMedia(message)`: `message.downloadMedia()`, extract mimetype/data/filename
- `getMediaType(mimetype)`: `image/` → image, `video/` → video, `audio/` → audio, `application/pdf` → document, else file
- `describeMedia(media, context)`: if image → construct `data:${mimetype};base64,${data}` URL → `aiEngine.analyzeMedia()`
- `formatForTelegram(media)`: size formatting (KB/MB), type/filename for display
- `isAnalyzable(media)`: only image and video

### `src/utils/logger.js` (37 LOC) — Winston Logger

**Useful patterns:**
- Format: `${timestamp} [${level}]: ${stack || message}` with `YYYY-MM-DD HH:mm:ss`
- Console transport with colorize
- File transports: `error.log` (error only) + `combined.log`, both with 5MB maxsize and 5 file rotation
- Level from `process.env.LOG_LEVEL || 'info'`

---

## Python Files — Concept Extraction Only (deleted after extraction)

### `src/models.py` (127 LOC) — SQLAlchemy Schema

**Extracted schema concepts → new SQLite DDL:**
- `Conversation`: chat_id (unique, indexed), platform, contact_name, contact_number, is_active, first_message_sent, pending_first_message, system_prompt, tone_level (Float), flirt_level (Float), temperature, max_tokens, settings (JSON), created_at, updated_at, last_message_at
- `Message`: conversation_id (FK), role, content, message_type, media_path, media_metadata (JSON), token_count, processing_time, created_at
- `BotStatus`: is_running, whatsapp_connected, telegram_connected, total_conversations, total_messages, active_conversations, cpu_usage, memory_usage, started_at, updated_at
- `AdminLog`: admin_id, admin_username, action, description, success, error_message, metadata (JSON), created_at

**New system changes:**
- tone/flirt_level stored as string enums, not floats
- Added: platform_conversation_id, platform_user_id, direction, media_mime_type, media_size_bytes, message status tracking, model_override, model_used
- BotStatus replaced by transport_status table (per-transport rows)

### `src/config.py` (236 LOC) — Configuration Manager

**Extracted patterns:**
- YAML + .env dual loading (new system: .env only, simpler)
- `get_system_prompt(tone_level, flirt_level, custom_prompt)`: closest-match algorithm for tone/flirt keys
- `_get_level_key()`: find closest float match in dict — replaced by direct string enum lookup
- `validate()`: check each required field, collect error list, log each error
- Finnish defaults: `default_language: "fi"`, base prompt in Finnish

### `src/database.py` (334 LOC) — Async SQLAlchemy CRUD

**Extracted patterns:**
- `get_or_create_conversation()`: select by chat_id, create if not found — exact pattern needed
- `update_conversation_settings()`: selective field update (only set fields that are not None)
- `mark_first_message_sent()`: single flag flip
- `add_message()`: lookup conversation by chat_id, create message, update conversation.last_message_at
- `get_conversation_history()`: query by conversation_id, order by created_at DESC, limit, then reverse for chronological
- `update_bot_status()`: upsert pattern (select, create if missing, update fields)
- `add_admin_log()`: simple insert with all fields
- All operations use async sessions with commit/refresh

### `src/openai/openai_manager.py` (293 LOC) — OpenAI with Media

**Extracted patterns:**
- `AsyncOpenAI(api_key=api_key)` client
- `tiktoken.encoding_for_model(model)` with fallback to `cl100k_base` — useful for token counting
- `generate_response()` returns `(response_text, token_count)` tuple
- `analyze_image()`:
  - File size validation (max 5MB)
  - Extension validation (jpg, jpeg, png, gif, webp)
  - Base64 encode file → `data:{mime_type};base64,{data}` URL
  - Vision API: `gpt-4-vision-preview` with `[text, image_url]` content blocks, max_tokens=500
- `transcribe_audio()`:
  - Open file → `client.audio.transcriptions.create(model="whisper-1", file=file, language=lang)`
  - Returns `transcript.text`
- `analyze_video_frame()`: delegates to `analyze_image()`

### `src/conversation/conversation_manager.py` (363 LOC) — Conversation Orchestration

**Extracted patterns:**
- `start_conversation()`: get_or_create + return `needs_first_message` flag
- `configure_conversation()`: range validation on tone (0-1) and flirt (0-1) before DB update
- `set_pending_first_message()`: persist to DB for crash recovery (pending_first_message column)
- `process_incoming_message()` full flow:
  1. Get conversation from DB
  2. Check `first_message_sent` — refuse AI response if false
  3. If media: process via `_process_media()`, add description to content
  4. Save user message to DB
  5. Get conversation history from DB
  6. Build system prompt via config.get_system_prompt(tone, flirt, custom)
  7. Generate AI response
  8. Save assistant message to DB with token_count and processing_time
  9. Return response text
- `_process_media()`: route image → analyze, audio → transcribe, video → frame analysis

### `src/telegram/telegram_bot.py` (386 LOC) — Python Telegram Admin

**Extracted patterns (concepts only, Node.js version is primary reference):**
- `python-telegram-bot` Application builder
- Commands: /start, /stop, /restart, /status, /list, /configure, /help, /stats, /logs
- CallbackQueryHandler for inline button interactions
- Admin check on every command
- Finnish language responses
- DB integration for status updates and admin logging

---

## Intentionally Discarded

| Item | Reason |
|---|---|
| `src/whatsapp/whatsapp_bot.py` (WhatsApp via webwhatsapi) | Uses deprecated webwhatsapi + Selenium. No maintained package. Zero usable patterns. |
| `src/whatsapp/whatsapp_bot_impl.py` (WhatsApp impl) | Same — dead webwhatsapi code with Chrome driver automation. |
| `chatbotserver.py` (Flask web GUI) | Calls `db.get_conversations()` and `db.get_messages()` which don't exist in database.py. Broken code. Uses `asyncio.new_event_loop()` per request (anti-pattern). |
| `config/config.yaml` | YAML config adds complexity. New system uses .env only. Tone/flirt level names extracted as string enums. |
| `examples/setup_conversation.py` | Python script for old system. Not applicable. |
| `runwithtermux.py` | Android-specific runner. Not in scope. |
| `install.py` | Python installer for Python system. Replaced by install.bat. |
| `validate_implementation.py` | Validates Python imports and structure. Not applicable. |
| `validate_webgui.py` | Validates Flask web GUI. Not applicable. |
| `tests/test_integration.py` | Tests Python config + DB + OpenAI mocks. New system has own tests. |
| `tests/test_whatsapp.py` | Tests Python WhatsApp bot in simulation mode. No value. |
| `tests/test_telegram_markdown.js` | Tests Markdown escaping for deleted TelegramController.js. Trivial. |
| `start.sh`, `start_webgui.sh` | Linux shell scripts for Python system. Windows-first now. |
| `systemd/` | Linux systemd service files. Not in scope. |
| All `__init__.py` files | Empty Python package markers. |
| All stale `.md` documentation | Describes aspirational system that doesn't match code. Will be rewritten. |
| `web/webgui.html`, `webgui.css`, `webgui.js` | Vanilla JS GUI for Flask backend. Replaced by React. |
