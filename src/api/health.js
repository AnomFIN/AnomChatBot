import { getDatabase } from '../persistence/database.js';
import { getIO } from '../realtime/socket.js';
import { getConversationCount } from '../persistence/conversations.js';
import { getTotalMessageCount } from '../persistence/messages.js';

/**
 * Health endpoint plugin.
 * GET /api/health — returns system status.
 */
export default async function healthRoutes(fastify, opts) {
  const { config, aiProvider } = opts;
  const startTime = Date.now();

  fastify.get('/api/health', async () => {
    const dbInitialized = getDatabase() !== null;

    return {
      success: true,
      data: {
        version: config.version,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          logLevel: config.logLevel,
        },
        database: {
          initialized: dbInitialized,
          conversations: dbInitialized ? getConversationCount() : 0,
          messages: dbInitialized ? getTotalMessageCount() : 0,
        },
        socket: {
          initialized: getIO() !== null,
        },
        ai: aiProvider ? aiProvider.getStatus() : { connected: false, model: null, provider: null },
        modes: {
          aiProvider: config.ai.provider,
          whatsappMode: config.whatsapp.mode,
          telegramEnabled: config.telegram.enabled,
        },
      },
    };
  });
}
