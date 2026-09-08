import { PrismaClient } from '@prisma/client';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { sendError } from '../http-errors.js';
import type { AccessTokenPayload, AuthAccount } from './types.js';

function unauthorized(reply: FastifyReply) {
  return sendError(reply, 401, 'UNAUTHORIZED', 'Требуется действующая авторизация.');
}

export function requireAccount(request: FastifyRequest): AuthAccount {
  if (!request.authAccount) {
    throw new Error('Authenticated route was reached without an account.');
  }

  return request.authAccount;
}

export function createAuthenticate(prisma: PrismaClient) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    let token: AccessTokenPayload;

    try {
      token = await request.jwtVerify<AccessTokenPayload>();
    } catch {
      return unauthorized(reply);
    }

    const session = await prisma.session.findUnique({
      where: { id: token.sid },
      select: {
        userId: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            authVersion: true,
            role: true,
          },
        },
      },
    });

    if (
      !session ||
      session.userId !== token.sub ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.status !== 'ACTIVE' ||
      session.user.authVersion !== token.ver
    ) {
      return unauthorized(reply);
    }

    request.authAccount = {
      id: session.user.id,
      email: session.user.email,
      authVersion: session.user.authVersion,
      sessionId: token.sid,
      role: session.user.role,
    };
  };
}

export function createRequireStaff(prisma: PrismaClient) {
  const authenticate = createAuthenticate(prisma);

  return async (request: FastifyRequest, reply: FastifyReply) => {
    await authenticate(request, reply);
    if (reply.sent) return;

    const account = requireAccount(request);
    if (account.role !== 'ADMIN' && account.role !== 'MODERATOR') {
      return sendError(reply, 403, 'ADMIN_FORBIDDEN', 'Доступ разрешён только модераторам.');
    }
  };
}
