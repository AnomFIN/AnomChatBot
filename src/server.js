import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';

/**
 * Create and configure the Fastify server instance.
 * Registers core plugins (CORS, formbody).
 * Static file serving and additional plugins added in later phases.
 */
export function createServer(config) {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Core plugins
  fastify.register(cors, { origin: true });
  fastify.register(formbody);

  return fastify;
}
