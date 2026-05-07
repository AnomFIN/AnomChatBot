// Security-first. Creator-ready. Future-proof.
export default async function transportRoutes(fastify, opts) {
  const { transportManager, config } = opts;

  fastify.post('/api/transport/qr/regenerate', async (request, reply) => {
    if (config.whatsapp.mode !== 'baileys') {
      return reply.code(409).send({
        success: false,
        error: 'QR login regeneration is only available in Baileys mode.',
      });
    }

    if (!transportManager?.regenerateLogin) {
      return reply.code(503).send({ success: false, error: 'WhatsApp transport is not ready.' });
    }

    const result = await transportManager.regenerateLogin();
    if (!result.success) {
      return reply.code(500).send({ success: false, error: result.error || 'Failed to regenerate QR login.' });
    }

    return { success: true, data: result.data };
  });
}
