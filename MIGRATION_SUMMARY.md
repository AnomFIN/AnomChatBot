# Migration Summary

> Final record of the AnomChatBot legacy-to-modern migration.

---

## Overview

AnomChatBot was rebuilt from a mixed Python/Node.js chatbot into a unified **Node.js 20+ ESM application** with a React admin GUI. The migration was executed in 6 phases with strict approval gating.

## What Was Kept (Concepts)

| Legacy Concept | New Implementation |
|---|---|
| Conversation manager state logic | `src/conversation/orchestrator.js` |
| Per-conversation settings (tone, flirt, system prompt) | SQLite `conversations` table, canonical string enums |
| First-message rule (operator sends first) | `orchestrator.js` enforces `auto_reply=0` on new conversations |
| OpenAI integration | `src/ai/provider.js` (official SDK, base URL override) |
| Telegram admin commands | `src/admin/telegram.js` (node-telegram-bot-api) |
| WhatsApp messaging | `src/transport/` (Cloud API + Baileys, both first-class) |
| Message history persistence | SQLite `messages` table via better-sqlite3 |
| Media handling concept | Preserved in transport adapters |

## What Was Rewritten

| Component | Old | New |
|---|---|---|
| HTTP server | Flask (Python) | Fastify 5 (Node.js ESM) |
| Database | SQLAlchemy + SQLite | better-sqlite3 with raw SQL |
| Config loading | Python dotenv | Node.js dotenv + validation |
| Real-time updates | Polling | Socket.IO 4 |
| Admin GUI | Vanilla HTML/JS | React 18 + Vite |
| WhatsApp transport | webwhatsapi (Python) | @whiskeysockets/baileys + Cloud API |
| Telegram bot | python-telegram-bot | node-telegram-bot-api |
| Logging | Python logging | pino + pino-pretty |
| Testing | None | vitest (156+ tests) |
| Install scripts | Python install.py | Node.js install.bat |

## What Was Deleted

| Item | Reason |
|---|---|
| Python runtime / requirements.txt | Single-runtime target: Node.js only |
| Flask server code | Replaced by Fastify |
| SQLAlchemy models | Replaced by raw SQL with better-sqlite3 |
| webwhatsapi integration | Replaced by Baileys + Cloud API |
| install.py | Replaced by install.bat |
| Legacy Node.js index.js | Rewritten from scratch, original archived to `_legacy/` |
| Stale config files | Replaced by single `.env.example` |

## Legacy Archive

Original Node.js files preserved in `_legacy/` for reference:
- `_legacy/index.js` — Original entry point
- `_legacy/bridges/WhatsAppBridge.js` — Original WhatsApp Web bridge
- `_legacy/bridges/TelegramController.js` — Original Telegram controller
- `_legacy/handlers/MediaHandler.js` — Original media handler
- `_legacy/managers/AIEngine.js` — Original AI engine
- `_legacy/managers/ConversationManager.js` — Original conversation manager
- `_legacy/utils/logger.js` — Original logger

## Architecture Changes

### Before
- Dual Python + Node.js runtime
- Python Flask for HTTP, Node.js for WhatsApp bridge
- No real-time GUI updates
- Telegram as the only admin interface
- No automated tests

### After
- Single Node.js 20+ ESM runtime
- Fastify 5 HTTP server with Schema validation
- React 18 admin GUI with Socket.IO real-time
- Telegram admin is optional (GUI works standalone)
- 156+ automated tests (config, persistence, AI, orchestrator, API, transport)
- SQLite with WAL mode, proper indexes, foreign keys
- Both WhatsApp Cloud API and Baileys with equal engineering quality
- Windows-first install/start scripts

## Phase History

| Phase | Scope | Status |
|---|---|---|
| 1 | Audit, Extract & Archive | ✅ Complete |
| 2 | Architecture & Scaffold | ✅ Complete |
| 3 | Backend Skeleton | ✅ Complete |
| 4 | Persistence + AI + Message Flow | ✅ Complete |
| 5 | WhatsApp End-to-End | ✅ Complete |
| 6 | React GUI + Windows Scripts + Hardening | ✅ Complete |

## Known Limitations

1. **Baileys (WhatsApp Web)**: Unofficial protocol. WhatsApp can change it without notice. Sessions may expire.
2. **Cloud API**: Requires Meta Business Account and public webhook URL (ngrok for development).
3. **No authentication on GUI**: The admin GUI binds to `127.0.0.1` by default. Do not expose to public internet without adding authentication.
4. **SQLite**: Single-writer. Adequate for single-instance chatbot, not for horizontal scaling.
5. **Media**: Image/audio support depends on transport capabilities and OpenAI model features.
