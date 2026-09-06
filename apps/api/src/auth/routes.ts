import { randomUUID } from 'node:crypto';

import { Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AppConfig } from '../config.js';
import { parseBody, sendError } from '../http-errors.js';
import { hashPassword, verifyPassword } from './passwords.js';
import {
  changePasswordSchema,
  deleteAccountSchema,
  loginSchema,
  profileSchema,
  refreshSchema,
  registerSchema,
} from './schemas.js';
import {
  createRefreshToken,
  getRefreshTokenId,
  hashRefreshToken,
  refreshTokenMatches,
} from './tokens.js';
import type { AccessTokenPayload, AuthAccount } from './types.js';

const publicUserSelect = {
  id: true,
  email: true,
  status: true,
  profile: {
    select: {
      nickname: true,
      language: true,
      city: {
        select: {
          id: true,
          slug: true,
          nameRu: true,
          regionRu: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

class InvalidRefreshTokenError extends Error {}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function unauthorized(reply: FastifyReply) {
  return sendError(reply, 401, 'UNAUTHORIZED', 'Требуется действующая авторизация.');
}

function invalidCredentials(reply: FastifyReply) {
  return sendError(reply, 401, 'INVALID_CREDENTIALS', 'Неверный email или пароль.');
}

function requireAccount(request: FastifyRequest): AuthAccount {
  if (!request.authAccount) {
    throw new Error('Authenticated route was reached without an account.');
  }

  return request.authAccount;
}

async function loadPublicUser(prisma: PrismaClient, userId: string) {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: publicUserSelect,
  });
}

function createAccessToken(
  app: FastifyInstance,
  account: { id: string; authVersion: number },
  sessionId: string,
) {
  return app.jwt.sign({
    sub: account.id,
    sid: sessionId,
    ver: account.authVersion,
  });
}

async function sendTokenPair(
  app: FastifyInstance,
  reply: FastifyReply,
  prisma: PrismaClient,
  config: AppConfig,
  account: { id: string; authVersion: number },
  session: { id: string; token: string },
  statusCode = 200,
) {
  const user = await loadPublicUser(prisma, account.id);

  return reply.code(statusCode).send({
    accessToken: createAccessToken(app, account, session.id),
    refreshToken: session.token,
    tokenType: 'Bearer',
    expiresIn: config.JWT_ACCESS_TTL_SECONDS,
    user,
  });
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  config: AppConfig,
) {
  app.decorateRequest('authAccount', null);

  const dummyPasswordHash = await hashPassword(`dummy-${randomUUID()}-password`);

  const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
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
    };
  };

  app.post(
    '/auth/register',
    { config: { rateLimit: { max: 3, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = parseBody(registerSchema, request.body, reply);
      if (!body) return;

      const city = await prisma.city.findFirst({
        where: { id: body.cityId, isActive: true },
        select: { id: true },
      });

      if (!city) {
        return sendError(reply, 400, 'INVALID_CITY', 'Выберите доступный город.');
      }

      const passwordHash = await hashPassword(body.password);
      const refresh = createRefreshToken(config.REFRESH_TOKEN_TTL_DAYS);

      try {
        const account = await prisma.$transaction(async (transaction) => {
          const user = await transaction.user.create({
            data: {
              email: body.email,
              passwordHash,
              profile: {
                create: {
                  nickname: body.nickname,
                  cityId: city.id,
                  language: body.language,
                },
              },
            },
            select: { id: true, authVersion: true },
          });

          await transaction.session.create({
            data: {
              id: refresh.id,
              userId: user.id,
              refreshTokenHash: refresh.hash,
              expiresAt: refresh.expiresAt,
            },
          });

          await transaction.auditLog.create({
            data: {
              actorId: user.id,
              action: 'account.registered',
              entityType: 'user',
              entityId: user.id,
            },
          });

          return user;
        });

        return sendTokenPair(app, reply, prisma, config, account, refresh, 201);
      } catch (error: unknown) {
        if (isUniqueConstraintError(error)) {
          return sendError(reply, 409, 'EMAIL_ALREADY_USED', 'Этот email уже зарегистрирован.');
        }

        throw error;
      }
    },
  );

  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = parseBody(loginSchema, request.body, reply);
      if (!body) return;

      const user = await prisma.user.findUnique({
        where: { email: body.email },
        select: {
          id: true,
          status: true,
          authVersion: true,
          passwordHash: true,
        },
      });
      const usableHash = user?.status === 'ACTIVE' ? user.passwordHash : dummyPasswordHash;
      const passwordIsValid = await verifyPassword(usableHash, body.password);

      if (!user || user.status !== 'ACTIVE' || !passwordIsValid) {
        return invalidCredentials(reply);
      }

      const refresh = createRefreshToken(config.REFRESH_TOKEN_TTL_DAYS);
      await prisma.session.create({
        data: {
          id: refresh.id,
          userId: user.id,
          refreshTokenHash: refresh.hash,
          expiresAt: refresh.expiresAt,
        },
      });

      return sendTokenPair(app, reply, prisma, config, user, refresh);
    },
  );

  app.post(
    '/auth/refresh',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = parseBody(refreshSchema, request.body, reply);
      if (!body) return;

      const sessionId = getRefreshTokenId(body.refreshToken);
      if (!sessionId) return unauthorized(reply);

      const current = await prisma.session.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          userId: true,
          refreshTokenHash: true,
          revokedAt: true,
          expiresAt: true,
          user: { select: { id: true, status: true, authVersion: true } },
        },
      });

      if (
        !current ||
        current.revokedAt ||
        current.expiresAt <= new Date() ||
        current.user.status !== 'ACTIVE' ||
        !refreshTokenMatches(current.refreshTokenHash, body.refreshToken)
      ) {
        return unauthorized(reply);
      }

      const next = createRefreshToken(config.REFRESH_TOKEN_TTL_DAYS);

      try {
        await prisma.$transaction(async (transaction) => {
          const revoked = await transaction.session.updateMany({
            where: {
              id: current.id,
              refreshTokenHash: current.refreshTokenHash,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
            data: { revokedAt: new Date() },
          });

          if (revoked.count !== 1) {
            throw new InvalidRefreshTokenError();
          }

          await transaction.session.create({
            data: {
              id: next.id,
              userId: current.userId,
              refreshTokenHash: next.hash,
              expiresAt: next.expiresAt,
              rotatedFromId: current.id,
            },
          });
        });
      } catch (error: unknown) {
        if (error instanceof InvalidRefreshTokenError || isUniqueConstraintError(error)) {
          return unauthorized(reply);
        }

        throw error;
      }

      return sendTokenPair(app, reply, prisma, config, current.user, next);
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    const body = parseBody(refreshSchema, request.body, reply);
    if (!body) return;

    const sessionId = getRefreshTokenId(body.refreshToken);
    if (sessionId) {
      await prisma.session.updateMany({
        where: {
          id: sessionId,
          refreshTokenHash: hashRefreshToken(body.refreshToken),
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    return reply.code(204).send();
  });

  app.get('/auth/me', { onRequest: authenticate }, async (request) => {
    const account = requireAccount(request);
    return { user: await loadPublicUser(prisma, account.id) };
  });

  app.put('/account/profile', { onRequest: authenticate }, async (request, reply) => {
    const account = requireAccount(request);
    const body = parseBody(profileSchema, request.body, reply);
    if (!body) return;

    const city = await prisma.city.findFirst({
      where: { id: body.cityId, isActive: true },
      select: { id: true },
    });
    if (!city) {
      return sendError(reply, 400, 'INVALID_CITY', 'Выберите доступный город.');
    }

    await prisma.profile.upsert({
      where: { userId: account.id },
      update: { nickname: body.nickname, cityId: city.id, language: body.language },
      create: {
        userId: account.id,
        nickname: body.nickname,
        cityId: city.id,
        language: body.language,
      },
    });

    return { user: await loadPublicUser(prisma, account.id) };
  });

  app.post('/account/password', { onRequest: authenticate }, async (request, reply) => {
    const account = requireAccount(request);
    const body = parseBody(changePasswordSchema, request.body, reply);
    if (!body) return;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: account.id },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
      return invalidCredentials(reply);
    }

    if (await verifyPassword(user.passwordHash, body.newPassword)) {
      return sendError(reply, 400, 'PASSWORD_UNCHANGED', 'Новый пароль должен отличаться.');
    }

    const passwordHash = await hashPassword(body.newPassword);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: account.id },
        data: { passwordHash, authVersion: { increment: 1 } },
      }),
      prisma.session.updateMany({
        where: { userId: account.id, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.auditLog.create({
        data: {
          actorId: account.id,
          action: 'account.password_changed',
          entityType: 'user',
          entityId: account.id,
        },
      }),
    ]);

    return reply.code(204).send();
  });

  app.delete('/account', { onRequest: authenticate }, async (request, reply) => {
    const account = requireAccount(request);
    const body = parseBody(deleteAccountSchema, request.body, reply);
    if (!body) return;

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: account.id },
      select: { passwordHash: true },
    });

    if (!(await verifyPassword(user.passwordHash, body.currentPassword))) {
      return invalidCredentials(reply);
    }

    const now = new Date();
    const anonymizedEmail = `${account.id}@deleted.invalid`;

    await prisma.$transaction(async (transaction) => {
      await transaction.session.deleteMany({ where: { userId: account.id } });
      await transaction.deviceToken.deleteMany({ where: { userId: account.id } });
      await transaction.favorite.deleteMany({ where: { userId: account.id } });
      await transaction.block.deleteMany({
        where: { OR: [{ blockerId: account.id }, { blockedId: account.id }] },
      });
      await transaction.profile.deleteMany({ where: { userId: account.id } });
      await transaction.report.updateMany({
        where: { reporterId: account.id },
        data: { details: null },
      });
      await transaction.offer.updateMany({
        where: { senderId: account.id },
        data: {
          status: 'WITHDRAWN',
          description: null,
          price: null,
          decidedAt: null,
          withdrawnAt: now,
        },
      });
      await transaction.ad.updateMany({
        where: { ownerId: account.id },
        data: {
          title: 'Удалённое объявление',
          description: '',
          budget: null,
          status: 'CLOSED',
          closedAt: now,
        },
      });
      await transaction.user.update({
        where: { id: account.id },
        data: {
          email: anonymizedEmail,
          passwordHash: `deleted:${randomUUID()}`,
          status: 'DELETED',
          deletedAt: now,
          authVersion: { increment: 1 },
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: account.id,
          action: 'account.deleted',
          entityType: 'user',
          entityId: account.id,
        },
      });
    });

    return reply.code(204).send();
  });
}
