import { DevicePlatform, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { createAuthenticate, requireAccount } from '../auth/guard.js';
import { parseBody, sendError } from '../http-errors.js';
import { isExpoPushToken } from './expo-sender.js';

const registerSchema = z.object({
  token: z.string().trim().max(500).refine(isExpoPushToken),
  platform: z.enum(['android', 'ios']),
});
const idParams = z.object({ id: z.string().uuid() });

export function registerNotificationRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const authenticate = createAuthenticate(prisma);

  app.post(
    '/account/device-tokens',
    { onRequest: authenticate, config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const account = requireAccount(request);
      const body = parseBody(registerSchema, request.body, reply);
      if (!body) return;
      const deviceToken = await prisma.deviceToken.upsert({
        where: { token: body.token },
        update: {
          userId: account.id,
          platform: body.platform.toUpperCase() as DevicePlatform,
          isEnabled: true,
          lastSeenAt: new Date(),
        },
        create: {
          userId: account.id,
          token: body.token,
          platform: body.platform.toUpperCase() as DevicePlatform,
        },
        select: { id: true, platform: true, isEnabled: true, lastSeenAt: true },
      });
      return reply.code(201).send({
        deviceToken: { ...deviceToken, platform: deviceToken.platform.toLowerCase() },
      });
    },
  );

  app.delete('/account/device-tokens/:id', { onRequest: authenticate }, async (request, reply) => {
    const account = requireAccount(request);
    const params = parseBody(idParams, request.params, reply);
    if (!params) return;
    const result = await prisma.deviceToken.deleteMany({
      where: { id: params.id, userId: account.id },
    });
    if (result.count === 0) {
      return sendError(reply, 404, 'DEVICE_TOKEN_NOT_FOUND', 'Устройство не найдено.');
    }
    return reply.code(204).send();
  });
}
