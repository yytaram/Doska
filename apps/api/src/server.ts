import { randomUUID } from 'node:crypto';

import fastifyCors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import Fastify, { type FastifyServerOptions } from 'fastify';

import { registerAdRoutes } from './ads/routes.js';
import { registerAdminRoutes } from './admin/routes.js';
import { registerAuthRoutes } from './auth/routes.js';
import './auth/types.js';
import type { AppConfig } from './config.js';
import { createDatabase, type Database } from './database.js';
import { sendError } from './http-errors.js';
import { ExpoNotificationSender } from './notifications/expo-sender.js';
import { registerNotificationRoutes } from './notifications/routes.js';
import type { NotificationSender } from './notifications/service.js';
import { createNotificationWorker } from './notifications/worker.js';
import { registerOfferRoutes } from './offers/routes.js';
import { registerChatSocket } from './offers/socket.js';
import { registerReferenceRoutes } from './reference/routes.js';
import { registerReportRoutes } from './reports/routes.js';

interface BuildServerOptions {
  config: AppConfig;
  database?: Database;
  logger?: FastifyServerOptions['logger'];
  notificationSender?: NotificationSender;
  prisma?: PrismaClient;
}

export function buildServer({
  config,
  database = createDatabase(config.DATABASE_URL),
  logger,
  notificationSender = new ExpoNotificationSender(config.EXPO_PUSH_URL, config.EXPO_ACCESS_TOKEN),
  prisma = new PrismaClient(),
}: BuildServerOptions) {
  const app = Fastify({
    genReqId(request) {
      const supplied = request.headers['x-request-id'];
      return typeof supplied === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(supplied)
        ? supplied
        : randomUUID();
    },
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
            'req.body.body',
            'req.body.description',
            'req.body.details',
            'req.body.token',
            'res.headers["set-cookie"]',
          ],
          censor: '[REDACTED]',
        },
      } as const),
  });

  app.decorateRequest('authAccount', null);

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('x-request-id', request.id);
    return payload;
  });

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
  app.register(async (reportApp) => registerReportRoutes(reportApp, prisma));
  app.register(async (adminApp) => registerAdminRoutes(adminApp, prisma));
  app.register(async (notificationApp) => registerNotificationRoutes(notificationApp, prisma));

  app.get('/health', async () => ({ status: 'ok' }));

  app.get('/health/live', async () => ({ status: 'ok' }));

  app.get('/health/database', async (_request, reply) => {
    try {
      await database.ping();
      return { status: 'ok' };
    } catch (error: unknown) {
      app.log.warn({ event: 'health.database_unavailable', error }, 'Database health check failed');
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  app.get('/health/ready', async (_request, reply) => {
    try {
      await database.ping();
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  const notificationWorker = createNotificationWorker(prisma, notificationSender, app.log);
  app.addHook('onReady', async () => {
    if (config.NODE_ENV !== 'test') notificationWorker.start();
  });

  app.addHook('onClose', async () => {
    notificationWorker.stop();
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

    request.log.error({ event: 'request.failed', error }, 'Unhandled request error');
    return sendError(reply, 500, 'INTERNAL_ERROR', 'Внутренняя ошибка сервера.');
  });

  return app;
}
