# Manual Testing Procedures

> These procedures verify functionality that cannot be fully covered by automated tests.
> Run through after any significant change to transport, GUI, or persistence layers.

---

## Prerequisites

- Node.js 20+
- `.env` configured with at least `OPENAI_API_KEY` and one WhatsApp transport
- Backend dependencies installed (`npm install`)
- Frontend built (`cd web && npm install && npm run build`)

---

## 1. Fresh Install (Windows)

1. Clone the repo into a path **with no spaces** (e.g., `C:\Projects\AnomChatBot`).
2. Double-click `install.bat`.
3. **Verify**:
   - Node.js version >= 20 printed
   - Backend + frontend installs succeed
   - `web\dist\index.html` exists
   - `.env` created from template (if first install)
   - `data\` directory created

---

## 2. First Start (Minimal Config)

1. Edit `.env`: set `OPENAI_API_KEY`, leave `WHATSAPP_MODE=baileys`, `TELEGRAM_ENABLED=false`.
2. Run `start.bat` (Windows) or `npm start` (any OS).
3. **Verify**:
   - Config summary printed (keys redacted)
   - Database initialized message
   - Socket.IO initialized message
   - AI provider connection test result
   - Baileys transport starts (QR code shown in terminal)
   - Server listening on `http://127.0.0.1:3001`
   - No unhandled errors in console

---

## 3. Web GUI — Dashboard

1. Open `http://127.0.0.1:3001` in Chrome/Edge.
2. **Verify**:
   - Dark theme loads, no FOUC
   - Status bar shows Socket (green when connected), WhatsApp status, AI status
   - Tabs visible: Conversations, System, QR / WhatsApp, Logs
   - System tab shows server info, database stats, AI config, transport config
   - Logs tab shows real-time log entries streaming

---

## 4. Web GUI — QR Code (Baileys Mode)

1. With `WHATSAPP_MODE=baileys` and **no saved session**, start the server.
2. Navigate to the "QR / WhatsApp" tab.
3. **Verify**:
   - QR code image displays
   - Status shows "Waiting for QR scan"
4. Scan QR with WhatsApp mobile.
5. **Verify**:
   - Status changes to "Connected"
   - QR code disappears, replaced by connected message
   - Status bar WhatsApp indicator turns green

---

## 5. WhatsApp Cloud API — Webhook Verification

1. Set `WHATSAPP_MODE=cloud_api` with valid Cloud API credentials.
2. Start server, expose via ngrok: `ngrok http 3001`.
3. Configure webhook in Meta Developer Portal: `https://<ngrok-url>/webhook/whatsapp`.
4. **Verify**:
   - Webhook verification succeeds (Meta sends challenge, server responds)
   - Console logs: "WhatsApp webhook registered"

---

## 6. Send/Receive Messages

1. With WhatsApp connected (either mode), send a message from a phone to the bot number.
2. **Verify**:
   - Message appears in Conversations tab
   - New conversation created with phone number
   - Message content displayed correctly
3. Click the conversation, type a reply in the input box, press Enter.
4. **Verify**:
   - Message sent (if auto_reply is off, operator reply sent directly)
   - Message appears in conversation view
   - Reply received on the phone

---

## 7. AI Auto-Reply

1. Open a conversation, go to its settings panel.
2. Toggle "Auto Reply" ON.
3. **Verify**: Setting persists (refresh page, still on).
4. Send a message from the phone.
5. **Verify**:
   - AI generates a reply automatically
   - Reply appears in conversation view and on the phone
   - Token count logged

---

## 8. Per-Conversation Settings

1. Open a conversation's settings panel.
2. Change: tone → playful, flirt → subtle, temperature → 0.9, system prompt → custom text.
3. Click Save.
4. **Verify**: Settings persist after page refresh.
5. Send a message — **verify** AI response reflects the new tone/prompt.

---

## 9. Telegram Admin (Optional)

1. Set `TELEGRAM_ENABLED=true`, `TELEGRAM_BOT_TOKEN=<token>`, `TELEGRAM_ADMIN_IDS=<your_id>`.
2. Restart server.
3. In Telegram, send `/start` to your bot.
4. **Verify**:
   - Welcome message with command list
   - `/status` shows system health
   - `/list` shows conversations (or "no active conversations")
   - `/stats` shows message counts
5. Try commands from a non-admin ID — **verify** they are rejected.

---

## 10. Graceful Shutdown

1. With server running, press Ctrl+C.
2. **Verify**:
   - "Received SIGINT, shutting down…" logged
   - Transports shut down
   - Database closed
   - "Shutdown complete" logged
   - Process exits cleanly

---

## 11. Persistence After Restart

1. Start server, create a conversation, send messages, change settings.
2. Stop server (Ctrl+C).
3. Start server again.
4. **Verify**:
   - All conversations preserved
   - Message history intact
   - Per-conversation settings preserved
   - Baileys session preserved (no new QR required)

---

## 12. Health Check

1. With server running, open `http://127.0.0.1:3001/api/health`.
2. **Verify** JSON response:
   - `success: true`
   - `data` is present
   - WhatsApp health details reflect the actual transport state
   - AI health details reflect the actual AI connection state
   - Database health details include the expected conversation/message counts
3. On Windows: run `healthcheck.bat` — **verify** summary prints correctly.

---

## 13. Error Recovery

1. Start with invalid `OPENAI_API_KEY`.
   - **Verify**: Server still starts, AI status shows error, GUI shows AI degraded.
2. Start with `WHATSAPP_MODE=cloud_api` but no credentials.
   - **Verify**: Server starts, WhatsApp shows error status, other features work.
3. Delete `data/anomchatbot.db`, restart.
   - **Verify**: Database recreated automatically, fresh state.
