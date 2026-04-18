# Migration Progress

## Current Phase: 2 — Architecture & Scaffold ✅

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

### Phase 3: Database Layer
### Phase 4: AI Engine
### Phase 5: WhatsApp Cloud API Transport
### Phase 6: Baileys Transport
### Phase 7: Telegram Admin Transport
### Phase 8: Conversation Orchestrator
### Phase 9: Fastify API + Socket.IO
### Phase 10: React GUI
### Phase 11: Windows Scripts & Documentation
### Phase 12: Final Validation & _legacy Cleanup

## Blockers

(none)

## Decisions Log

(locked decisions recorded here as phases execute)
