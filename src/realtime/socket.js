import { Server } from 'socket.io';

let io = null;

/**
 * Initialize Socket.IO on the Fastify server's underlying HTTP server.
 * Registers basic connection logging and status emit.
 */
export function initSocket(fastify) {
  io = new Server(fastify.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

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
