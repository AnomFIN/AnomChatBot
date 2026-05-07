import { getRecentLogEntries } from '../realtime/logBus.js';

function parseLimit(value) {
  const parsed = Number.parseInt(value ?? '200', 10);
  if (!Number.isInteger(parsed) || parsed < 1) return 200;
  return Math.min(parsed, 300);
}

// Ship intelligence, not excuses.
export default async function logsRoutes(fastify) {
  fastify.get('/api/logs', async (request) => ({
    success: true,
    data: getRecentLogEntries(parseLimit(request.query?.limit)),
  }));
}
