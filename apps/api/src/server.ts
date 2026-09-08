import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyServerOptions } from 'fastify';

import { registerAdRoutes } from './ads/routes.js';
import { registerAuthRoutes } from './auth/routes.js';
import './auth/types.js';
import type { AppConfig } from './config.js';
import { createDatabase, type Database } from './database.js';
import { sendError } from './http-errors.js';
import { registerOfferRoutes } from './offers/routes.js';
import { registerChatSocket } from './offers/socket.js';
import { registerReferenceRoutes } from './reference/routes.js';

interface BuildServerOptions {
  config: AppConfig;
  database?: Database;
  logger?: FastifyServerOptions['logger'];
  prisma?: PrismaClient;
}

export function buildServer({
  config,
  database = createDatabase(config.DATABASE_URL),
  logger,
  prisma = new PrismaClient(),
}: BuildServerOptions) {
  const app = Fastify({
    logger:
      logger ??
      ({
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.currentPassword',
            'req.body.newPassword',
            'req.body.refreshToken',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
      } as const),
  });

  app.decorateRequest('authAccount', null);

  app.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'production' ? false : true,
  });

  app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    sign: {
      algorithm: 'HS256',
      expiresIn: `${config.JWT_ACCESS_TTL_SECONDS}s`,
      iss: 'doska-api',
      aud: 'doska-mobile',
    },
    verify: {
      algorithms: ['HS256'],
      allowedIss: 'doska-api',
      allowedAud: 'doska-mobile',
    },
  });
  app.register(fastifyRateLimit, { global: false });
  const chatIo = registerChatSocket(app, prisma);
  app.register(async (authApp) => registerAuthRoutes(authApp, prisma, config));
  app.register(async (adApp) => registerAdRoutes(adApp, prisma));
  app.register(async (offerApp) => registerOfferRoutes(offerApp, prisma, chatIo));
  app.register(async (referenceApp) => registerReferenceRoutes(referenceApp, prisma));

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
    await Promise.all([database.close(), prisma.$disconnect()]);
  });

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : undefined;

    if (statusCode === 429) {
      return sendError(reply, 429, 'RATE_LIMITED', 'Слишком много попыток. Повторите позже.');
    }

    if (statusCode && statusCode >= 400 && statusCode < 500) {
      return sendError(reply, statusCode, 'INVALID_REQUEST', 'Некорректный запрос.');
    }

    request.log.error({ error }, 'Unhandled request error');
    return sendError(reply, 500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера.');
  });

  return app;
}
