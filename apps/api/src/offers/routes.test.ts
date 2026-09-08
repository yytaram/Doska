import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { PrismaClient } from '@prisma/client';
import { io as createSocket, type Socket } from 'socket.io-client';

import { getConfig } from '../config.js';
import { buildServer } from '../server.js';

interface Auth {
  accessToken: string;
  user: { id: string };
}

interface OfferResponse {
  offer: { chat: { id: string }; id: string; status: string };
}

const password = 'Offer-chat-test-password-2026!';

test('offers and chat enforce participants, lifecycle, blocking and unread state', async () => {
  const prisma = new PrismaClient();
  const app = buildServer({
    config: getConfig({
      NODE_ENV: 'test',
      JWT_SECRET: 'offers-test-jwt-secret-with-at-least-32-characters',
    }),
    prisma,
    logger: false,
  });
  const suffix = randomUUID();
  const userIds: string[] = [];
  const adIds: string[] = [];
  const sockets: Socket[] = [];

  function authorization(auth: Auth) {
    return { authorization: `Bearer ${auth.accessToken}` };
  }

  async function register(name: string, cityId: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        acceptedMinimumAge: true,
        cityId,
        email: `offer-user-${userIds.length}-${suffix}@example.test`,
        language: 'ru',
        nickname: name,
        password,
      },
    });
    assert.equal(response.statusCode, 201);
    const auth = response.json<Auth>();
    userIds.push(auth.user.id);
    return auth;
  }

  async function connectSocket(address: string, auth: Auth) {
    const socket = createSocket(address, {
      auth: { token: auth.accessToken },
      forceNew: true,
      transports: ['websocket'],
    });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Socket connection timed out.')), 3000);
      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    return socket;
  }

  function emitAck<T>(socket: Socket, event: string, payload: object) {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Socket ${event} timed out.`)), 3000);
      socket.emit(event, payload, (result: T) => {
        clearTimeout(timeout);
        resolve(result);
      });
    });
  }

  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const city = await prisma.city.findFirstOrThrow({ where: { isActive: true } });
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } });
    const owner = await register('Владелец', city.id);
    const sender = await register('Продавец', city.id);
    const stranger = await register('Посторонний', city.id);

    for (const title of ['Куплю тестовый телефон', 'Куплю тестовый ноутбук']) {
      const ad = await prisma.ad.create({
        data: {
          budget: 300000,
          categoryId: category.id,
          cityId: city.id,
          condition: 'GOOD',
          description: `Достаточно длинное описание: ${title}.`,
          ownerId: owner.user.id,
          publishedAt: new Date(),
          status: 'ACTIVE',
          title,
        },
      });
      adIds.push(ad.id);
    }

    const ownOffer = await app.inject({
      method: 'POST',
      url: `/ads/${adIds[0]}/offers`,
      headers: authorization(owner),
      payload: { price: 250000, description: 'Есть такой телефон.' },
    });
    assert.equal(ownOffer.statusCode, 409);

    const creation = await app.inject({
      method: 'POST',
      url: `/ads/${adIds[0]}/offers`,
      headers: authorization(sender),
      payload: { price: 250000, description: 'Есть подходящий телефон в отличном состоянии.' },
    });
    assert.equal(creation.statusCode, 201);
    const firstOffer = creation.json<OfferResponse>().offer;
    assert.equal(firstOffer.status, 'pending');
    assert.ok(firstOffer.chat.id);

    const duplicate = await app.inject({
      method: 'POST',
      url: `/ads/${adIds[0]}/offers`,
      headers: authorization(sender),
      payload: { description: 'Повторное предложение.' },
    });
    assert.equal(duplicate.statusCode, 409);

    const strangerRead = await app.inject({
      method: 'GET',
      url: `/chats/${firstOffer.chat.id}/messages`,
      headers: authorization(stranger),
    });
    assert.equal(strangerRead.statusCode, 404);

    const strangerSocket = await connectSocket(address, stranger);
    const strangerJoin = await emitAck<{ error?: { code: string } }>(strangerSocket, 'chat:join', {
      id: firstOffer.chat.id,
    });
    assert.equal(strangerJoin.error?.code, 'CHAT_NOT_FOUND');

    const senderSocket = await connectSocket(address, sender);
    const senderJoin = await emitAck<{ ok?: true }>(senderSocket, 'chat:join', {
      id: firstOffer.chat.id,
    });
    assert.equal(senderJoin.ok, true);
    const sentMessage = await emitAck<{ error?: unknown; message?: { body: string } }>(
      senderSocket,
      'message:send',
      { body: 'Здравствуйте! Телефон ещё доступен.', id: firstOffer.chat.id },
    );
    assert.equal(sentMessage.error, undefined);
    assert.equal(sentMessage.message?.body, 'Здравствуйте! Телефон ещё доступен.');

    const ownerChats = await app.inject({
      method: 'GET',
      url: '/chats',
      headers: authorization(owner),
    });
    assert.equal(ownerChats.statusCode, 200);
    const ownerChat = ownerChats
      .json<{ chats: Array<{ id: string; unreadCount: number }> }>()
      .chats.find(({ id }) => id === firstOffer.chat.id);
    assert.equal(ownerChat?.unreadCount, 1);

    const read = await app.inject({
      method: 'POST',
      url: `/chats/${firstOffer.chat.id}/read`,
      headers: authorization(owner),
    });
    assert.equal(read.statusCode, 204);

    const reply = await app.inject({
      method: 'POST',
      url: `/chats/${firstOffer.chat.id}/messages`,
      headers: authorization(owner),
      payload: { body: 'Здравствуйте! Пришлите, пожалуйста, подробности.' },
    });
    assert.equal(reply.statusCode, 201);

    const messages = await app.inject({
      method: 'GET',
      url: `/chats/${firstOffer.chat.id}/messages?limit=1`,
      headers: authorization(sender),
    });
    assert.equal(messages.statusCode, 200);
    assert.equal(messages.json<{ items: unknown[]; nextCursor: string | null }>().items.length, 1);
    assert.ok(messages.json<{ nextCursor: string | null }>().nextCursor);

    const tooLong = await app.inject({
      method: 'POST',
      url: `/chats/${firstOffer.chat.id}/messages`,
      headers: authorization(sender),
      payload: { body: 'а'.repeat(2001) },
    });
    assert.equal(tooLong.statusCode, 400);

    const block = await app.inject({
      method: 'PUT',
      url: `/account/blocks/${sender.user.id}`,
      headers: authorization(owner),
    });
    assert.equal(block.statusCode, 204);
    const blockedMessage = await app.inject({
      method: 'POST',
      url: `/chats/${firstOffer.chat.id}/messages`,
      headers: authorization(sender),
      payload: { body: 'Это сообщение не должно сохраниться.' },
    });
    assert.equal(blockedMessage.statusCode, 403);
    const unblock = await app.inject({
      method: 'DELETE',
      url: `/account/blocks/${sender.user.id}`,
      headers: authorization(owner),
    });
    assert.equal(unblock.statusCode, 204);

    const secondCreation = await app.inject({
      method: 'POST',
      url: `/ads/${adIds[1]}/offers`,
      headers: authorization(sender),
      payload: { price: 290000, description: 'Есть подходящий ноутбук.' },
    });
    assert.equal(secondCreation.statusCode, 201);
    const secondOffer = secondCreation.json<OfferResponse>().offer;

    const ownerOffers = await app.inject({
      method: 'GET',
      url: `/ads/${adIds[0]}/offers`,
      headers: authorization(owner),
    });
    assert.equal(ownerOffers.statusCode, 200);
    assert.equal(ownerOffers.json<{ items: unknown[] }>().items.length, 1);

    const sentOffers = await app.inject({
      method: 'GET',
      url: '/account/offers',
      headers: authorization(sender),
    });
    assert.equal(sentOffers.statusCode, 200);
    assert.equal(sentOffers.json<{ items: unknown[] }>().items.length, 2);

    const accepted = await app.inject({
      method: 'POST',
      url: `/offers/${firstOffer.id}/accept`,
      headers: authorization(owner),
    });
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.json<OfferResponse>().offer.status, 'accepted');

    const rejected = await app.inject({
      method: 'POST',
      url: `/offers/${secondOffer.id}/reject`,
      headers: authorization(owner),
    });
    assert.equal(rejected.statusCode, 200);
    assert.equal(rejected.json<OfferResponse>().offer.status, 'rejected');

    const strangerOffer = await app.inject({
      method: 'POST',
      url: `/ads/${adIds[1]}/offers`,
      headers: authorization(stranger),
      payload: { description: 'Предложение для проверки отзыва.' },
    });
    assert.equal(strangerOffer.statusCode, 201);
    const withdrawn = await app.inject({
      method: 'POST',
      url: `/offers/${strangerOffer.json<OfferResponse>().offer.id}/withdraw`,
      headers: authorization(stranger),
    });
    assert.equal(withdrawn.statusCode, 200);
    assert.equal(withdrawn.json<OfferResponse>().offer.status, 'withdrawn');
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.message.deleteMany({ where: { senderId: { in: userIds } } });
      await prisma.chat.deleteMany({ where: { offer: { senderId: { in: userIds } } } });
      await prisma.offer.deleteMany({ where: { senderId: { in: userIds } } });
      await prisma.ad.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.profile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.block.deleteMany({
        where: { OR: [{ blockerId: { in: userIds } }, { blockedId: { in: userIds } }] },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await app.close();
  }
});
