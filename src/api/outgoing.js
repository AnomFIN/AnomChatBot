// Engineered for autonomy, designed for humans.

const MAX_CONTENT_LENGTH = 8000;

/**
 * Outgoing AI review API.
 * Why this design:
 * - Routes are tiny wrappers around orchestrator controls so timer state has one owner.
 * - Inputs are strict strings/actions; bad requests fail before touching queue state.
 * - The GUI can reconnect safely by fetching the current in-memory queue snapshot.
 */
export default async function outgoingRoutes(fastify, opts) {
  const { orchestrator } = opts;

  fastify.get('/api/outgoing', async () => ({
    success: true,
    data: orchestrator.getOutgoingMessages(),
  }));

  fastify.post('/api/outgoing/:id/pause', async (request, reply) => {
    return handleQueueAction(reply, () => orchestrator.pauseOutgoingMessage(request.params.id));
  });

  fastify.post('/api/outgoing/:id/resume', async (request, reply) => {
    return handleQueueAction(reply, () => orchestrator.resumeOutgoingMessage(request.params.id));
  });

  fastify.put('/api/outgoing/:id', async (request, reply) => {
    const { content } = request.body || {};
    const validation = validateContent(content);
    if (!validation.valid) {
      reply.code(400);
      return { success: false, error: validation.error };
    }

    return handleQueueAction(reply, () => orchestrator.editOutgoingMessage(request.params.id, validation.content));
  });

  fastify.delete('/api/outgoing/:id', async (request, reply) => {
    return handleQueueAction(reply, () => {
      const deleted = orchestrator.deleteOutgoingMessage(request.params.id);
      if (!deleted) throw new Error('Outgoing message not found');
      return { id: request.params.id, deleted: true };
    });
  });
}

function handleQueueAction(reply, action) {
  try {
    return { success: true, data: action() };
  } catch (err) {
    if (String(err.message || '').includes('not found')) {
      reply.code(404);
      return { success: false, error: err.message };
    }
    reply.code(400);
    return { success: false, error: err.message || 'Invalid outgoing queue action' };
  }
}

function validateContent(content) {
  if (typeof content !== 'string') return { valid: false, error: 'content must be a string' };
  const normalized = content.replace(/\u0000/g, '').trim();
  if (!normalized) return { valid: false, error: 'content must not be empty' };
  if (normalized.length > MAX_CONTENT_LENGTH) return { valid: false, error: `content must be ${MAX_CONTENT_LENGTH} characters or less` };
  return { valid: true, content: normalized };
}
