import Fastify from 'fastify';

import type { AppConfig } from './config.js';
import { createDatabase, type Database } from './database.js';

interface BuildServerOptions {
  config: AppConfig;
  database?: Database;
}

export function buildServer({ config, database = createDatabase(config.DATABASE_URL) }: BuildServerOptions) {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/database', async (_request, reply) => {
    try {
      await database.ping();
      return { status: 'ok' };
    } catch (error: unknown) {
      app.log.warn({ error }, 'Database health check failed');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  app.addHook('onClose', async () => {
    await database.close();
  });

  return app;
}
