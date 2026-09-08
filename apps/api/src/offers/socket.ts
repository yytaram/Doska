import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';

import type { AccessTokenPayload } from '../auth/types.js';
import { createChatMessage, findChatForUser } from './chat-service.js';
import { idParamsSchema, messageSchema } from './schemas.js';

type Ack = (result: {
  error?: { code: string; message: string };
  message?: unknown;
  ok?: true;
}) => void;

class SocketRateLimiter {
  private readonly attempts = new Map<string, number[]>();

  allow(key: string, maximum = 30, windowMs = 60_000) {
    const now = Date.now();
    const recent = (this.attempts.get(key) ?? []).filter((time) => time > now - windowMs);
    if (recent.length >= maximum) return false;
    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }
}

async function authenticateToken(app: FastifyInstance, prisma: PrismaClient, token: unknown) {
  if (typeof token !== 'string') return null;
  try {
    const payload = app.jwt.verify<AccessTokenPayload>(token);
    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: { select: { id: true, status: true, authVersion: true } },
      },
    });
    if (
      !session ||
      session.userId !== payload.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE' ||
      session.user.authVersion !== payload.ver
    ) {
      return null;
    }
    return session.user.id;
  } catch {
    return null;
  }
}

export function registerChatSocket(app: FastifyInstance, prisma: PrismaClient) {
  const io = new Server(app.server, {
    cors: { origin: process.env.NODE_ENV === 'production' ? false : '*' },
    transports: ['websocket', 'polling'],
  });
  const limiter = new SocketRateLimiter();

  io.use(async (socket, next) => {
    const userId = await authenticateToken(app, prisma, socket.handshake.auth.token);
    if (!userId) return next(new Error('UNAUTHORIZED'));
    socket.data.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;

    socket.on('chat:join', async (input: unknown, ack: Ack = () => undefined) => {
      const parsed = idParamsSchema.safeParse(input);
      if (!parsed.success || !(await findChatForUser(prisma, parsed.data.id, userId))) {
        return ack({ error: { code: 'CHAT_NOT_FOUND', message: 'Чат не найден.' } });
      }
      await socket.join(`chat:${parsed.data.id}`);
      ack({ ok: true });
    });

    socket.on('message:send', async (input: unknown, ack: Ack = () => undefined) => {
      const parsed = idParamsSchema.and(messageSchema).safeParse(input);
      if (!parsed.success) {
        return ack({
          error: {
            code: 'INVALID_MESSAGE',
            message: 'Сообщение должно содержать от 1 до 2000 символов.',
          },
        });
      }
      if (!limiter.allow(userId)) {
        return ack({ error: { code: 'RATE_LIMITED', message: 'Слишком много сообщений.' } });
      }
      const result = await createChatMessage(prisma, parsed.data.id, userId, parsed.data.body);
      if ('error' in result) {
        return ack({
          error:
            result.error === 'blocked'
              ? { code: 'USER_BLOCKED', message: 'Сообщения недоступны из-за блокировки.' }
              : { code: 'CHAT_NOT_FOUND', message: 'Чат не найден.' },
        });
      }
      io.to(`chat:${parsed.data.id}`).emit('message:new', result.message);
      ack({ message: result.message });
    });

    socket.on('chat:read', async (input: unknown, ack: Ack = () => undefined) => {
      const parsed = idParamsSchema.safeParse(input);
      if (!parsed.success || !(await findChatForUser(prisma, parsed.data.id, userId))) {
        return ack({ error: { code: 'CHAT_NOT_FOUND', message: 'Чат не найден.' } });
      }
      await prisma.message.updateMany({
        where: { chatId: parsed.data.id, senderId: { not: userId }, readAt: null },
        data: { readAt: new Date() },
      });
      socket.to(`chat:${parsed.data.id}`).emit('chat:read', { chatId: parsed.data.id });
      ack({ ok: true });
    });
  });

  app.addHook('onClose', async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });

  return io;
}
