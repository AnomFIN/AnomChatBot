import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIST = join(__dirname, '../web/dist');
const MEDIA_DIR = join(process.cwd(), 'data', 'media');

/**
 * Create and configure the Fastify server instance.
 * Registers core plugins (CORS, formbody, static file serving).
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

  // Serve React GUI build if it exists (registered first to provide reply.sendFile)
  if (existsSync(join(WEB_DIST, 'index.html'))) {
    fastify.register(fastifyStatic, {
      root: WEB_DIST,
      prefix: '/',
      wildcard: true,
    });

    // SPA fallback: non-API routes serve index.html
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/webhook/') || request.url.startsWith('/media/')) {
        reply.code(404).send({ success: false, error: 'Not found' });
      } else {
        reply.sendFile('index.html');
      }
    });
  } else {
    fastify.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/') || request.url.startsWith('/webhook/') || request.url.startsWith('/media/')) {
        reply.code(404).send({ success: false, error: 'Not found' });
      } else {
        reply.code(200).type('text/html').send(
          '<html><body style="background:#0f1117;color:#e4e6eb;font-family:sans-serif;padding:40px;text-align:center">' +
          '<h1>AnomChatBot</h1><p>GUI not built yet. Run <code>cd web && npm install && npm run build</code></p>' +
          '<p>API available at <a href="/api/health" style="color:#3b82f6">/api/health</a></p></body></html>'
        );
      }
    });
  }

  // Serve stored media files at /media/{filename} (decorateReply:false since static already registered above)
  mkdirSync(MEDIA_DIR, { recursive: true });
  fastify.register(fastifyStatic, {
    root: MEDIA_DIR,
    prefix: '/media/',
    decorateReply: false,
    cacheControl: true,
    maxAge: 86400000, // 24h cache
  });

  return fastify;
}
