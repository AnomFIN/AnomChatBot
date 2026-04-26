# Project Guidelines

## Code Style
- Use Node.js ESM style already used in `src/` (`import`/`export`, no CommonJS).
- Keep modules focused by layer (config, transport, ai, conversation, persistence, api, realtime, admin).
- Reuse canonical config enums from `src/config/index.js` instead of hardcoding values in routes, services, or tests.
- Keep logs structured and safe: do not log secrets or raw credential values.

## Architecture
- Backend source lives in `src/`; frontend source lives in `web/src/`.
- Treat `src/conversation/orchestrator.js` as the central message flow coordinator.
- Treat `src/transport/base.js` and `src/transport/manager.js` as the transport contract/factory boundary.
- Keep persistence changes inside `src/persistence/` and update schema/repositories together.
- `_legacy/` is archived reference code; do not migrate or delete legacy files unless explicitly requested.

## Build and Test
- Backend install/run:
  - `npm install`
  - `npm run dev` (watch mode)
  - `npm start` (normal start)
- Frontend:
  - `cd web && npm install`
  - `cd web && npm run dev`
  - `cd web && npm run build`
- Tests:
  - `npm test`
  - `npm run test:watch`
- If you change API contracts or transport behavior, run `npm test` before finalizing.

## Conventions
- Preserve the first-message rule behavior in conversation flow.
- Respect runtime mode selection for WhatsApp transport (`cloud_api` vs `baileys`); avoid mode-specific assumptions in shared logic.
- GUI binds to localhost by default; do not introduce changes that imply public exposure without explicit auth/security requirements.
- For migration or destructive refactor tasks, follow strict approval-gated execution discipline documented in `.github/skills/migration-execution-control/SKILL.md`.

## Documentation Map
- System and component boundaries: `ARCHITECTURE.md`
- Setup, config, scripts, and endpoints: `README.md`
- Manual validation scenarios: `MANUAL_TESTING.md`
- Migration planning and history: `MIGRATION.md`, `MIGRATION_SUMMARY.md`, `LEGACY_EXTRACTION.md`