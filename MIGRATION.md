# Migration Progress

## Current Phase: 4 — Persistence + AI + Internal Message Flow ✅

## Phase Checklist

### Phase 1: Audit, Extract & Archive ✅
- [x] LEGACY_EXTRACTION.md created
- [x] Node.js files archived to _legacy/
- [x] Python/stale files deleted
- [x] .gitignore rewritten
- [x] Clean state validated

### Phase 2: Architecture & Scaffold ✅
- [x] ARCHITECTURE.md created
- [x] .env.example updated (WHATSAPP_MODE, gpt-4o-mini default, canonical enums)
- [x] package.json updated (v2.0.0, Fastify/Socket.IO/better-sqlite3 deps)
- [x] web/package.json created (React 18, Vite, socket.io-client)
- [x] src/ directory scaffold: config, transport, ai, conversation, persistence, api, realtime, admin
- [x] web/ directory scaffold: src/components, src/hooks, src/context, src/api
- [x] data/ directory with .gitkeep

### Phase 3: Backend Skeleton ✅
- [x] src/config/index.js — config loader with dotenv, validation, canonical enums, safe logging
- [x] src/persistence/database.js — better-sqlite3 init, WAL mode, foreign keys, _meta bootstrap table
- [x] src/realtime/socket.js — Socket.IO on Fastify server, connection logging, status emit
- [x] src/api/health.js — GET /api/health with version, uptime, db/socket status, mode summary
- [x] src/server.js — Fastify 5 with pino-pretty, @fastify/cors, @fastify/formbody
- [x] src/index.js — entry point: config → db → socket → routes → listen → graceful shutdown
- [x] tests/config.test.js — 40 tests: enums, parsing, defaults, warnings, frozen config
- [x] package.json updated — added @fastify/formbody, vitest, test scripts
- [x] .env.example updated — PORT=3001, WHATSAPP_MODE=cloud_api|baileys, new default/media keys
- [x] Server boots cleanly, /api/health returns full contract, graceful shutdown works

### Phase 4: Persistence + AI + Internal Message Flow ✅
- [x] src/persistence/schema.js — Full schema: conversations, messages, admin_logs, transport_status + indexes
- [x] src/persistence/conversations.js — CRUD: create, get, list, getOrCreate, updateSettings, touch, count
- [x] src/persistence/messages.js — CRUD: add, getMessages (paginated), getRecentMessages (chronological), counts
- [x] src/persistence/database.js — Updated: imports and runs schema migrations, schema_version=1
- [x] src/ai/provider.js — OpenAI SDK client: generateReply, testConnection, getStatus, 429 retry, error classification
- [x] src/conversation/promptBuilder.js — System prompt assembly with canonical tone/flirt enums, history trimming
- [x] src/conversation/orchestrator.js — Central message router: incoming → persist → AI → persist → emit
- [x] src/api/conversations.js — GET /api/conversations, GET /:id, GET /:id/messages, POST /:id/messages
- [x] src/api/settings.js — GET /api/conversations/:id/settings, PUT /:id/settings with enum validation
- [x] src/api/health.js — Enhanced: AI provider status, DB conversation/message counts
- [x] src/realtime/socket.js — Added emit helpers: emitConversationNew, emitConversationUpdate, emitMessageNew
- [x] src/index.js — Updated: AI provider init, orchestrator creation, new route registration
- [x] tests/persistence.test.js — 28 tests: schema, conversations CRUD, messages CRUD, foreign keys, indexes
- [x] tests/ai.test.js — 13 tests: provider creation, generateReply mock, 429 retry, error classification, testConnection
- [x] tests/orchestrator.test.js — 15 tests: message flow, first-message rule, auto_reply toggle, AI error handling
- [x] tests/api.test.js — 24 tests: health, conversations list/get/post, messages pagination, settings GET/PUT/validation
- [x] 120/120 tests pass (40 config + 28 persistence + 13 ai + 15 orchestrator + 24 api)
- [x] Server boots cleanly, all endpoints respond correctly, graceful shutdown works
- [x] DB schema: 5 tables (_meta, conversations, messages, admin_logs, transport_status), schema_version=1
- [x] First-message rule enforced: auto_reply=0 until operator sends first message
- [x] Platform correction applied: 'telegram' not used as conversation platform (admin-only)

### Phase 5: WhatsApp End-to-End
### Phase 6: React GUI + Windows Scripts + Hardening

## Blockers

(none)

## Decisions Log

(locked decisions recorded here as phases execute)
