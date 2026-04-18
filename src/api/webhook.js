/**
 * WhatsApp Cloud API webhook routes.
 * Only registered when WHATSAPP_MODE=cloud_api.
 *
 * GET  /webhook/whatsapp — Meta webhook verification
 * POST /webhook/whatsapp — Inbound message delivery
 */
export default async function webhookRoutes(fastify, opts) {
  const { transportManager, config } = opts;
  const webhookPath = config.whatsapp.cloud.webhookPath || '/webhook/whatsapp';

  /**
   * GET — Webhook verification.
   * Meta sends hub.mode, hub.verify_token, hub.challenge.
   * We must return the challenge as plain text if the verify token matches.
   */
  fastify.get(webhookPath, {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          'hub.mode': { type: 'string' },
          'hub.verify_token': { type: 'string' },
          'hub.challenge': { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const transport = transportManager.getTransport();

    if (!transport || typeof transport.handleWebhookVerify !== 'function') {
      reply.code(503).send('Transport not available');
      return;
    }

    const challenge = transport.handleWebhookVerify(request.query);

    if (challenge !== null && challenge !== undefined) {
      // Meta expects the challenge returned as plain text with 200
      reply.code(200).type('text/plain').send(String(challenge));
    } else {
      reply.code(403).send('Verification failed');
    }
  });

  /**
   * POST — Inbound message delivery.
   * Meta sends the webhook payload as JSON.
   * We parse it and route through the transport adapter's event system.
   */
  fastify.post(webhookPath, async (request, reply) => {
    const transport = transportManager.getTransport();

    if (!transport || typeof transport.handleWebhookInbound !== 'function') {
      reply.code(503).send('Transport not available');
      return;
    }

    // Cloud API expects 200 quickly — process async
    transport.handleWebhookInbound(request.body);

    // Meta requires 200 response to acknowledge receipt
    reply.code(200).send('OK');
  });
}
