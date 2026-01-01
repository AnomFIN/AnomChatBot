# API Documentation

Internal API documentation for AnomChatBot modules.

## Core Modules

### WhatsAppBridge

**Location**: `src/bridges/WhatsAppBridge.js`

Handles WhatsApp Web connection and message routing.

#### Constructor
```javascript
new WhatsAppBridge(onMessage, onReady, onDisconnected)
```

**Parameters:**
- `onMessage` (Function): Callback for incoming messages
- `onReady` (Function): Callback when client is ready
- `onDisconnected` (Function): Callback on disconnection

#### Methods

##### `initialize()`
```javascript
await bridge.initialize()
```
Initializes WhatsApp client and displays QR code for scanning.

**Returns:** `Promise<boolean>` - Success status

##### `sendMessage(chatId, message)`
```javascript
await bridge.sendMessage('123456789@c.us', 'Hello!')
```
Sends text message to WhatsApp chat.

**Parameters:**
- `chatId` (string): WhatsApp chat ID
- `message` (string): Message text

**Returns:** `Promise<boolean>` - Success status

##### `sendMedia(chatId, media)`
```javascript
await bridge.sendMedia('123456789@c.us', mediaObject)
```
Sends media to WhatsApp chat.

**Parameters:**
- `chatId` (string): WhatsApp chat ID
- `media` (Object): Media object

**Returns:** `Promise<boolean>` - Success status

##### `getStatus()`
```javascript
const status = bridge.getStatus()
// Returns: { ready: true, lastError: null, reconnectAttempts: 0 }
```
Gets current connection status.

**Returns:** `Object` - Status information

---

### TelegramController

**Location**: `src/bridges/TelegramController.js`

Manages Telegram bot for operator control panel.

#### Constructor
```javascript
new TelegramController(token, adminId)
```

**Parameters:**
- `token` (string): Telegram bot token
- `adminId` (string): Telegram admin user ID

#### Methods

##### `initialize()`
```javascript
await telegram.initialize()
```
Initializes Telegram bot and sets up commands.

**Returns:** `Promise<boolean>` - Success status

##### `setCallbacks(callbacks)`
```javascript
telegram.setCallbacks({
  onManualResponse: async (chatId, message) => { },
  onEnableAI: async (chatId, prompt) => { },
  onDisableAI: async (chatId) => { },
  onGetStatus: async () => { },
  onListConversations: async () => { }
})
```
Sets callback handlers for bot operations.

**Parameters:**
- `callbacks` (Object): Object with callback functions

##### `forwardMessage(whatsappChatId, message, metadata)`
```javascript
await telegram.forwardMessage(
  '123456789@c.us',
  'Hello from WhatsApp',
  { contact: 'John', timestamp: '2025-12-28 15:00', hasMedia: false }
)
```
Forwards WhatsApp message to Telegram control panel.

**Parameters:**
- `whatsappChatId` (string): WhatsApp chat ID
- `message` (string): Message text
- `metadata` (Object): Additional metadata

**Returns:** `Promise<boolean>` - Success status

##### `sendNotification(message)`
```javascript
await telegram.sendNotification('⚠️ System alert!')
```
Sends notification to admin.

**Parameters:**
- `message` (string): Notification text

**Returns:** `Promise<boolean>` - Success status

##### `getStatus()`
```javascript
const status = telegram.getStatus()
// Returns: { ready: true, lastError: null }
```
Gets current bot status.

**Returns:** `Object` - Status information

---

### AIEngine

**Location**: `src/managers/AIEngine.js`

Handles OpenAI API integration and response generation.

#### Constructor
```javascript
new AIEngine(apiKey)
```

**Parameters:**
- `apiKey` (string): OpenAI API key

#### Methods

##### `initialize()`
```javascript
await aiEngine.initialize()
```
Tests OpenAI connection.

**Returns:** `Promise<boolean>` - Success status

##### `generateResponse(messages, settings)`
```javascript
const response = await aiEngine.generateResponse(
  [
    { role: 'system', content: 'You are helpful' },
    { role: 'user', content: 'Hello!' }
  ],
  { flirtLevel: 0.5, tone: 'friendly', aiAggressiveness: 0.5 }
)
```
Generates AI response based on conversation history.

**Parameters:**
- `messages` (Array): Array of message objects
- `settings` (Object): Conversation settings

**Returns:** `Promise<string>` - AI generated response

##### `analyzeMedia(mediaUrl, mediaType, context)`
```javascript
const description = await aiEngine.analyzeMedia(
  'data:image/jpeg;base64,...',
  'image',
  'Describe this naturally'
)
```
Analyzes media content using GPT-4 Vision.

**Parameters:**
- `mediaUrl` (string): Media data URL or URL
- `mediaType` (string): 'image', 'video', etc.
- `context` (string): Optional context prompt

**Returns:** `Promise<string>` - AI generated description

##### `getStatus()`
```javascript
const status = aiEngine.getStatus()
// Returns: { connected: true, lastError: null, model: 'gpt-4-turbo-preview' }
```
Gets current connection status.

**Returns:** `Object` - Status information

##### `reconnect()`
```javascript
await aiEngine.reconnect()
```
Attempts to reconnect to OpenAI.

**Returns:** `Promise<boolean>` - Success status

---

### ConversationManager

**Location**: `src/managers/ConversationManager.js`

Manages conversation state, history, and settings.

#### Constructor
```javascript
new ConversationManager()
```

#### Methods

##### `getConversation(chatId)`
```javascript
const conversation = manager.getConversation('123456789@c.us')
```
Gets or creates conversation data.

**Parameters:**
- `chatId` (string): Chat identifier

**Returns:** `Object` - Conversation object

**Conversation Object Structure:**
```javascript
{
  chatId: '123456789@c.us',
  active: true,
  aiEnabled: false,
  systemPrompt: null,
  firstMessageSent: false,
  history: [],
  settings: {
    flirtLevel: 0.5,
    tone: 'friendly',
    responseSpeed: 'normal',
    aiAggressiveness: 0.5
  },
  metadata: {
    createdAt: Date,
    lastActivity: Date,
    messageCount: 0
  }
}
```

##### `addMessage(chatId, role, content, metadata)`
```javascript
manager.addMessage(
  '123456789@c.us',
  'user',
  'Hello!',
  { timestamp: new Date() }
)
```
Adds message to conversation history.

**Parameters:**
- `chatId` (string): Chat identifier
- `role` (string): 'user', 'assistant', or 'system'
- `content` (string): Message content
- `metadata` (Object): Optional metadata

**Returns:** `Object` - Message object

##### `setSystemPrompt(chatId, prompt)`
```javascript
manager.setSystemPrompt('123456789@c.us', 'You are friendly')
```
Sets system prompt for AI personality.

**Parameters:**
- `chatId` (string): Chat identifier
- `prompt` (string): System prompt text

##### `setAiEnabled(chatId, enabled)`
```javascript
manager.setAiEnabled('123456789@c.us', true)
```
Enables or disables AI for conversation.

**Parameters:**
- `chatId` (string): Chat identifier
- `enabled` (boolean): Enable/disable AI

##### `updateSettings(chatId, settings)`
```javascript
manager.updateSettings('123456789@c.us', { flirtLevel: 0.7 })
```
Updates conversation settings.

**Parameters:**
- `chatId` (string): Chat identifier
- `settings` (Object): Settings to update

##### `getHistoryForAI(chatId, maxMessages)`
```javascript
const messages = manager.getHistoryForAI('123456789@c.us', 20)
```
Gets formatted conversation history for AI context.

**Parameters:**
- `chatId` (string): Chat identifier
- `maxMessages` (number): Max messages to include (default: 20)

**Returns:** `Array` - Array of message objects

##### `getActiveConversations()`
```javascript
const conversations = manager.getActiveConversations()
```
Gets all active conversations sorted by activity.

**Returns:** `Array` - Array of conversation objects

##### `getConversationSummary(chatId)`
```javascript
const summary = manager.getConversationSummary('123456789@c.us')
```
Gets conversation summary for display.

**Parameters:**
- `chatId` (string): Chat identifier

**Returns:** `Object` - Summary object

##### `clearHistory(chatId)`
```javascript
manager.clearHistory('123456789@c.us')
```
Clears conversation history.

**Parameters:**
- `chatId` (string): Chat identifier

##### `deleteConversation(chatId)`
```javascript
manager.deleteConversation('123456789@c.us')
```
Deletes entire conversation.

**Parameters:**
- `chatId` (string): Chat identifier

---

### MediaHandler

**Location**: `src/handlers/MediaHandler.js`

Handles media processing and AI analysis.

#### Constructor
```javascript
new MediaHandler(aiEngine)
```

**Parameters:**
- `aiEngine` (AIEngine): AI engine instance

#### Methods

##### `processMedia(message)`
```javascript
const media = await mediaHandler.processMedia(whatsappMessage)
```
Processes incoming media from WhatsApp.

**Parameters:**
- `message` (Object): WhatsApp message object

**Returns:** `Promise<Object|null>` - Media object or null

**Media Object Structure:**
```javascript
{
  data: 'base64...',
  mimetype: 'image/jpeg',
  filename: 'photo.jpg',
  type: 'image',
  size: 123456
}
```

##### `getMediaType(mimetype)`
```javascript
const type = mediaHandler.getMediaType('image/jpeg')
// Returns: 'image'
```
Gets media type from MIME type.

**Parameters:**
- `mimetype` (string): MIME type

**Returns:** `string` - Media type ('image', 'video', 'audio', 'document', 'file')

##### `describeMedia(media, context)`
```javascript
const description = await mediaHandler.describeMedia(mediaObject, 'Describe naturally')
```
Generates AI description for media.

**Parameters:**
- `media` (Object): Media object
- `context` (string): Optional context

**Returns:** `Promise<string>` - Description text

##### `formatForTelegram(media)`
```javascript
const formatted = mediaHandler.formatForTelegram(mediaObject)
```
Formats media info for Telegram display.

**Parameters:**
- `media` (Object): Media object

**Returns:** `Object` - Formatted media info

##### `isAnalyzable(media)`
```javascript
const canAnalyze = mediaHandler.isAnalyzable(mediaObject)
```
Checks if media can be analyzed by AI.

**Parameters:**
- `media` (Object): Media object

**Returns:** `boolean` - True if analyzable

---

## Logger

**Location**: `src/utils/logger.js`

Winston-based logging utility.

### Usage

```javascript
import logger from './src/utils/logger.js'

logger.info('Information message')
logger.warn('Warning message')
logger.error('Error message', error)
logger.debug('Debug message')
```

### Log Levels
- `error` - Error messages
- `warn` - Warning messages
- `info` - Information messages (default)
- `debug` - Debug messages

### Configuration

Set in `.env`:
```env
LOG_LEVEL=info
```

### Log Files
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only

---

## Main Application

**Location**: `index.js`

### AnomChatBot Class

Main application class that orchestrates all components.

#### Methods

##### `start()`
```javascript
await bot.start()
```
Starts all services and begins operation.

##### `shutdown()`
```javascript
await bot.shutdown()
```
Gracefully shuts down all services.

##### `getSystemStatus()`
```javascript
const status = await bot.getSystemStatus()
```
Gets comprehensive system status.

**Returns:** `Object` - Status of all components

---

## Events Flow

### Incoming WhatsApp Message

```
WhatsApp Message
    ↓
WhatsAppBridge.onMessage
    ↓
AnomChatBot.handleWhatsAppMessage
    ↓
ConversationManager.addMessage
    ↓
TelegramController.forwardMessage
    ↓
Telegram Admin Panel
```

### Manual Response

```
Telegram Reply
    ↓
TelegramController.onManualResponse
    ↓
AnomChatBot.handleManualResponse
    ↓
WhatsAppBridge.sendMessage
    ↓
WhatsApp User
```

### AI Response

```
WhatsApp Message (with AI enabled)
    ↓
ConversationManager.getHistoryForAI
    ↓
AIEngine.generateResponse
    ↓
WhatsAppBridge.sendMessage
    ↓
WhatsApp User
    ↓
TelegramController.sendNotification (to admin)
```

---

## Error Handling

All methods follow consistent error handling:

1. Try-catch blocks in all async operations
2. Errors logged with `logger.error()`
3. Graceful degradation (service failures don't crash bot)
4. Admin notifications for critical errors
5. Auto-reconnect for service disruptions

### Example

```javascript
try {
  await someOperation()
} catch (error) {
  logger.error('Operation failed:', error)
  await telegram.sendNotification('⚠️ Operation failed')
  // Continue operation or fallback
}
```

---

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=sk-...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_ADMIN_ID=123456789
LOG_LEVEL=info
```

### Conversation Settings

Per-conversation customizable:

```javascript
{
  flirtLevel: 0.1 - 1.0,          // AI flirtiness
  tone: 'friendly' | 'distant' | 'playful',
  responseSpeed: 'fast' | 'normal' | 'slow',
  aiAggressiveness: 0.1 - 1.0     // Response creativity
}
```

---

## Extension Points

### Adding New Commands

Edit `src/bridges/TelegramController.js`:

```javascript
this.bot.onText(/\/mycommand/, async (msg) => {
  if (!this.isAdmin(msg.from.id)) return;
  // Your command logic
  await this.bot.sendMessage(msg.chat.id, 'Response')
})
```

### Custom AI Models

Edit `src/managers/AIEngine.js`:

```javascript
model: 'gpt-4-turbo-preview'  // Change to your model
```

### Additional Media Types

Edit `src/handlers/MediaHandler.js`:

```javascript
getMediaType(mimetype) {
  if (mimetype === 'application/custom') return 'custom'
  // Add more types
}
```

---

## Testing

### Manual Testing

1. Send WhatsApp message
2. Check Telegram forwarding
3. Reply in Telegram
4. Verify WhatsApp delivery
5. Enable AI and test responses

### Component Testing

```javascript
// Test AI Engine
const engine = new AIEngine(apiKey)
await engine.initialize()
const response = await engine.generateResponse([...])

// Test Conversation Manager
const manager = new ConversationManager()
const conv = manager.getConversation('test')
manager.addMessage('test', 'user', 'Hello')
```

---

## Performance

### Memory Usage
- Base: ~150 MB
- Per conversation: ~1-5 MB
- Media processing: +100-500 MB (temporary)

### Response Times
- WhatsApp → Telegram: < 1 second
- Manual response: < 2 seconds
- AI response: 2-5 seconds (OpenAI latency)

### Scalability
- Designed for personal use (1-50 conversations)
- For high volume, consider:
  - Database for conversation storage
  - Redis for caching
  - Load balancing for multiple instances

---

This API documentation covers internal module interfaces. For user-facing documentation, see README.md.
