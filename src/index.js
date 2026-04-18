import { loadConfig, logConfigSummary } from './config/index.js';
import { createServer } from './server.js';
import { initDatabase, closeDatabase } from './persistence/database.js';
import { initSocket, closeSocket, getIO } from './realtime/socket.js';
import { createAIProvider } from './ai/provider.js';
import { createOrchestrator } from './conversation/orchestrator.js';
import { createTransportManager } from './transport/manager.js';
import healthRoutes from './api/health.js';
import conversationRoutes from './api/conversations.js';
import settingsRoutes from './api/settings.js';
import webhookRoutes from './api/webhook.js';

async function main() {
  // ── 1. Load and validate config ──────────────────────────────────────────
  const result = loadConfig();

  if (!result.valid) {
    console.error('\n✗ Configuration errors:\n');
    for (const err of result.errors) {
      console.error(`  ✗ ${err}`);
    }
    if (result.warnings.length > 0) {
      console.warn('\n  Warnings:');
      for (const w of result.warnings) {
        console.warn(`  ⚠ ${w}`);
      }
    }
    console.error('\nFix the above errors in .env and restart.\n');
    process.exit(1);
  }

  const { config, warnings } = result;

  // ── 2. Create server (includes pino logger) ──────────────────────────────
  const fastify = createServer(config);

  // Log any non-fatal warnings
  for (const w of warnings) {
    fastify.log.warn(w);
  }

  // Print config summary
  logConfigSummary(config, fastify.log);

  // ── 3. Initialize database ───────────────────────────────────────────────
  try {
    initDatabase(config);
    fastify.log.info('Database initialized');
  } catch (err) {
    fastify.log.fatal({ err }, 'Failed to initialize database');
    process.exit(1);
  }

  // ── 4. Initialize Socket.IO ──────────────────────────────────────────────
  initSocket(fastify);
  fastify.log.info('Socket.IO initialized');

  // ── 5. Initialize AI provider ────────────────────────────────────────────
  const aiProvider = createAIProvider(config);

  if (config.ai.openaiApiKey) {
    const testResult = await aiProvider.testConnection();
    if (testResult.success) {
      fastify.log.info(`AI provider connected (model: ${testResult.model})`);
    } else {
      fastify.log.warn(`AI provider connection failed: ${testResult.error}`);
    }
  } else {
    fastify.log.warn('AI provider not configured — no API key set');
  }

  // ── 6. Create orchestrator ───────────────────────────────────────────────
  const io = getIO();
  const orchestrator = createOrchestrator(config, aiProvider, io);
  fastify.log.info('Conversation orchestrator initialized');

  // ── 7. Initialize WhatsApp transport ─────────────────────────────────────
  const transportManager = createTransportManager(config, orchestrator, io, fastify.log);
  await transportManager.initialize();

  // ── 8. Register routes ───────────────────────────────────────────────────
  fastify.register(healthRoutes, { config, aiProvider, transportManager });
  fastify.register(conversationRoutes, { orchestrator });
  fastify.register(settingsRoutes, { io });

  // Register webhook routes only for Cloud API mode
  if (config.whatsapp.mode === 'cloud_api') {
    fastify.register(webhookRoutes, { transportManager, config });
    fastify.log.info(`WhatsApp webhook registered at ${config.whatsapp.cloud.webhookPath}`);
  }

  // ── 9. Graceful shutdown ─────────────────────────────────────────────────
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    fastify.log.info(`Received ${signal}, shutting down…`);
    try {
      await transportManager.shutdown();
      closeSocket();
      await fastify.close();
      closeDatabase();
      fastify.log.info('Shutdown complete');
    } catch (err) {
      fastify.log.error({ err }, 'Error during shutdown');
    }
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (err) => {
    fastify.log.error({ err }, 'Unhandled rejection');
  });

  // ── 10. Start listening ──────────────────────────────────────────────────
  try {
    await fastify.listen({ host: config.host, port: config.port });
    fastify.log.info(`AnomChatBot v${config.version} ready on ${config.host}:${config.port}`);
  } catch (err) {
    fastify.log.fatal({ err }, 'Failed to start server');
    closeDatabase();
    process.exit(1);
  }
}

main();
