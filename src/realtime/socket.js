import { Server } from 'socket.io';

let io = null;

function getAllowedSocketOrigins() {
  const configuredOrigins = process.env.SOCKET_IO_CORS_ORIGIN;

  if (!configuredOrigins) {
    return [];
  }

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Initialize Socket.IO on the Fastify server's underlying HTTP server.
 * Registers basic connection logging and status emit.
 */
export function initSocket(fastify) {
  const allowedOrigins = getAllowedSocketOrigins();
  const serverOptions = allowedOrigins.length > 0
    ? {
        cors: {
          origin: allowedOrigins,
          methods: ['GET', 'POST'],
        },
      }
    : {};

  io = new Server(fastify.server, serverOptions);
  io.on('connection', (socket) => {
    fastify.log.info(`Socket.IO: client connected (${socket.id})`);

    // Emit current server status on connect
    socket.emit('status:update', {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });

    socket.on('disconnect', (reason) => {
      fastify.log.debug(`Socket.IO: client disconnected (${socket.id}): ${reason}`);
    });
  });

  return io;
}

/**
 * Get the current Socket.IO server instance. Returns null if not initialized.
 */
export function getIO() {
  return io;
}

/**
 * Close Socket.IO server.
 */
export function closeSocket() {
  if (io) {
    io.close();
    io = null;
  }
}

// ── Emit helpers for business events ──────────────────────────────────────

export function emitConversationNew(conversation) {
  if (io) io.emit('conversation:new', { conversation });
}

export function emitConversationUpdate(conversation) {
  if (io) io.emit('conversation:update', { conversation });
}

export function emitMessageNew(conversationId, message) {
  if (io) io.emit('message:new', { conversationId, message });
}
