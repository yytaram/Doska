import { AdStatus, OfferStatus, Prisma, PrismaClient } from '@prisma/client';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Server as SocketServer } from 'socket.io';

import { createAuthenticate, requireAccount } from '../auth/guard.js';
import { parseBody, sendError } from '../http-errors.js';
import { createChatMessage, findChatForUser, usersAreBlocked } from './chat-service.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import {
  createOfferSchema,
  idParamsSchema,
  messageSchema,
  messagesQuerySchema,
  offersQuerySchema,
  userParamsSchema,
} from './schemas.js';
import { messageSelect, offerSelect, serializeMessage, serializeOffer } from './serializer.js';

function notFound(reply: FastifyReply, entity = 'Предложение') {
  return sendError(reply, 404, 'NOT_FOUND', `${entity} не найдено.`);
}

function pageCursor(value: string | undefined, reply: FastifyReply) {
  if (!value) return undefined;
  const cursor = decodeCursor(value);
  if (!cursor) {
    sendError(reply, 400, 'INVALID_CURSOR', 'Некорректный курсор страницы.');
    return null;
  }
  return cursor;
}

function cursorWhere(cursor: { createdAt: Date; id: string }): Prisma.OfferWhereInput {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

function offerPage(offers: Array<Parameters<typeof serializeOffer>[0]>, limit: number) {
  const hasMore = offers.length > limit;
  const page = hasMore ? offers.slice(0, limit) : offers;
  const last = page.at(-1);
  return {
    items: page.map(serializeOffer),
    nextCursor: hasMore && last ? encodeCursor(last) : null,
  };
}

export function registerOfferRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  chatIo?: SocketServer,
) {
  const authenticate = createAuthenticate(prisma);

  app.post(
    '/ads/:id/offers',
    { onRequest: authenticate, config: { rateLimit: { max: 20, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(idParamsSchema, request.params, reply);
      const body = parseBody(createOfferSchema, request.body, reply);
      if (!params || !body) return;

      const ad = await prisma.ad.findFirst({
        where: {
          id: params.id,
          status: AdStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true, ownerId: true },
      });
      if (!ad) return notFound(reply, 'Объявление');
      if (ad.ownerId === account.id) {
        return sendError(reply, 409, 'OWN_AD', 'Нельзя отправить предложение самому себе.');
      }
      if (await usersAreBlocked(prisma, account.id, ad.ownerId)) {
        return sendError(reply, 403, 'USER_BLOCKED', 'Предложение недоступно из-за блокировки.');
      }

      try {
        const offer = await prisma.$transaction(async (transaction) => {
          const created = await transaction.offer.create({
            data: {
              adId: ad.id,
              senderId: account.id,
              price: body.price ?? null,
              description: body.description ?? null,
              chat: { create: {} },
            },
            select: offerSelect,
          });
          await transaction.auditLog.create({
            data: {
              actorId: account.id,
              action: 'offer.created',
              entityType: 'offer',
              entityId: created.id,
            },
          });
          return created;
        });
        return reply.code(201).send({ offer: serializeOffer(offer) });
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          return sendError(
            reply,
            409,
            'DUPLICATE_OFFER',
            'Вы уже отправляли предложение к этому объявлению.',
          );
        }
        throw error;
      }
    },
  );

  app.get(
    '/account/offers',
    { onRequest: authenticate, config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const account = requireAccount(request);
      const query = parseBody(offersQuerySchema, request.query, reply);
      if (!query) return;
      const cursor = pageCursor(query.cursor, reply);
      if (cursor === null) return;
      const offers = await prisma.offer.findMany({
        where: { senderId: account.id, ...(cursor ? { AND: [cursorWhere(cursor)] } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: offerSelect,
      });
      return offerPage(offers, query.limit);
    },
  );

  app.get(
    '/ads/:id/offers',
    { onRequest: authenticate, config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(idParamsSchema, request.params, reply);
      const query = parseBody(offersQuerySchema, request.query, reply);
      if (!params || !query) return;
      const ad = await prisma.ad.findFirst({
        where: { id: params.id, ownerId: account.id },
        select: { id: true },
      });
      if (!ad) return notFound(reply, 'Объявление');
      const cursor = pageCursor(query.cursor, reply);
      if (cursor === null) return;
      const offers = await prisma.offer.findMany({
        where: { adId: ad.id, ...(cursor ? { AND: [cursorWhere(cursor)] } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: offerSelect,
      });
      return offerPage(offers, query.limit);
    },
  );

  app.post(
    '/offers/:id/withdraw',
    { onRequest: authenticate, config: { rateLimit: { max: 60, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(idParamsSchema, request.params, reply);
      if (!params) return;
      const result = await prisma.offer.updateMany({
        where: { id: params.id, senderId: account.id, status: OfferStatus.PENDING },
        data: { status: OfferStatus.WITHDRAWN, withdrawnAt: new Date() },
      });
      if (result.count !== 1) return notFound(reply);
      const offer = await prisma.offer.findUniqueOrThrow({
        where: { id: params.id },
        select: offerSelect,
      });
      return { offer: serializeOffer(offer) };
    },
  );

  for (const decision of ['accept', 'reject'] as const) {
    app.post(
      `/offers/:id/${decision}`,
      { onRequest: authenticate, config: { rateLimit: { max: 60, timeWindow: '1 hour' } } },
      async (request, reply) => {
        const account = requireAccount(request);
        const params = parseBody(idParamsSchema, request.params, reply);
        if (!params) return;
        const nextStatus = decision === 'accept' ? OfferStatus.ACCEPTED : OfferStatus.REJECTED;
        const offer = await prisma.offer.findFirst({
          where: { id: params.id, ad: { ownerId: account.id } },
          select: { id: true, adId: true, status: true },
        });
        if (!offer || offer.status !== OfferStatus.PENDING) return notFound(reply);

        await prisma.$transaction(async (transaction) => {
          const changed = await transaction.offer.updateMany({
            where: { id: offer.id, status: OfferStatus.PENDING },
            data: { status: nextStatus, decidedAt: new Date() },
          });
          if (changed.count !== 1) throw new Error('OFFER_STATE_CHANGED');
          if (nextStatus === OfferStatus.ACCEPTED) {
            await transaction.offer.updateMany({
              where: { adId: offer.adId, id: { not: offer.id }, status: OfferStatus.PENDING },
              data: { status: OfferStatus.REJECTED, decidedAt: new Date() },
            });
          }
          await transaction.auditLog.create({
            data: {
              actorId: account.id,
              action: `offer.${decision}ed`,
              entityType: 'offer',
              entityId: offer.id,
            },
          });
        });
        const updated = await prisma.offer.findUniqueOrThrow({
          where: { id: offer.id },
          select: offerSelect,
        });
        return { offer: serializeOffer(updated) };
      },
    );
  }

  registerChatRoutes(app, prisma, authenticate, chatIo);
  registerBlockRoutes(app, prisma, authenticate);
}

function registerChatRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  authenticate: ReturnType<typeof createAuthenticate>,
  chatIo?: SocketServer,
) {
  app.get(
    '/chats',
    { onRequest: authenticate, config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request) => {
      const account = requireAccount(request);
      const chats = await prisma.chat.findMany({
        where: {
          OR: [{ offer: { senderId: account.id } }, { offer: { ad: { ownerId: account.id } } }],
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          lastMessageAt: true,
          offer: {
            select: {
              id: true,
              senderId: true,
              status: true,
              sender: { select: { id: true, profile: { select: { nickname: true } } } },
              ad: {
                select: {
                  id: true,
                  ownerId: true,
                  title: true,
                  owner: { select: { id: true, profile: { select: { nickname: true } } } },
                },
              },
            },
          },
          messages: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 1,
            select: messageSelect,
          },
        },
      });
      return {
        chats: await Promise.all(
          chats.map(async ({ messages, ...chat }) => {
            const counterpart =
              chat.offer.senderId === account.id ? chat.offer.ad.owner : chat.offer.sender;
            return {
              ...chat,
              offer: { ...chat.offer, status: chat.offer.status.toLowerCase() },
              counterpart,
              lastMessage: messages[0] ? serializeMessage(messages[0]) : null,
              unreadCount: await prisma.message.count({
                where: { chatId: chat.id, senderId: { not: account.id }, readAt: null },
              }),
            };
          }),
        ),
      };
    },
  );

  app.get(
    '/chats/:id/messages',
    { onRequest: authenticate, config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(idParamsSchema, request.params, reply);
      const query = parseBody(messagesQuerySchema, request.query, reply);
      if (!params || !query) return;
      if (!(await findChatForUser(prisma, params.id, account.id))) return notFound(reply, 'Чат');
      const cursor = pageCursor(query.cursor, reply);
      if (cursor === null) return;
      const messages = await prisma.message.findMany({
        where: {
          chatId: params.id,
          ...(cursor
            ? {
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }
            : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: messageSelect,
      });
      const hasMore = messages.length > query.limit;
      const page = hasMore ? messages.slice(0, query.limit) : messages;
      const last = page.at(-1);
      return {
        items: page.map(serializeMessage),
        nextCursor: hasMore && last ? encodeCursor(last) : null,
      };
    },
  );

  app.post(
    '/chats/:id/messages',
    { onRequest: authenticate, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(idParamsSchema, request.params, reply);
      const body = parseBody(messageSchema, request.body, reply);
      if (!params || !body) return;
      const result = await createChatMessage(prisma, params.id, account.id, body.body);
      if ('error' in result) {
        return result.error === 'blocked'
          ? sendError(reply, 403, 'USER_BLOCKED', 'Сообщения недоступны из-за блокировки.')
          : notFound(reply, 'Чат');
      }
      chatIo?.to(`chat:${params.id}`).emit('message:new', result.message);
      return reply.code(201).send(result);
    },
  );

  app.post('/chats/:id/read', { onRequest: authenticate }, async (request, reply) => {
    const account = requireAccount(request);
    const params = parseBody(idParamsSchema, request.params, reply);
    if (!params) return;
    if (!(await findChatForUser(prisma, params.id, account.id))) return notFound(reply, 'Чат');
    await prisma.message.updateMany({
      where: { chatId: params.id, senderId: { not: account.id }, readAt: null },
      data: { readAt: new Date() },
    });
    return reply.code(204).send();
  });
}

function registerBlockRoutes(
  app: FastifyInstance,
  prisma: PrismaClient,
  authenticate: ReturnType<typeof createAuthenticate>,
) {
  app.put('/account/blocks/:userId', { onRequest: authenticate }, async (request, reply) => {
    const account = requireAccount(request);
    const params = parseBody(userParamsSchema, request.params, reply);
    if (!params) return;
    if (params.userId === account.id) {
      return sendError(reply, 400, 'SELF_BLOCK', 'Нельзя заблокировать самого себя.');
    }
    const target = await prisma.user.findFirst({
      where: { id: params.userId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!target) return notFound(reply, 'Пользователь');
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: account.id, blockedId: target.id } },
      create: { blockerId: account.id, blockedId: target.id },
      update: {},
    });
    return reply.code(204).send();
  });

  app.delete('/account/blocks/:userId', { onRequest: authenticate }, async (request, reply) => {
    const account = requireAccount(request);
    const params = parseBody(userParamsSchema, request.params, reply);
    if (!params) return;
    await prisma.block.deleteMany({ where: { blockerId: account.id, blockedId: params.userId } });
    return reply.code(204).send();
  });
}
