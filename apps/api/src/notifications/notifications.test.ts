import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { NotificationType, PrismaClient, UserRole } from '@prisma/client';

import { getConfig } from '../config.js';
import { buildServer } from '../server.js';
import {
  enqueueExpiringAdNotifications,
  enqueueNotification,
  processNotificationJobs,
  type NotificationSender,
  type PushMessage,
} from './service.js';

test('device tokens, retry-safe delivery, private content and health checks', async () => {
  const prisma = new PrismaClient();
  const noopSender: NotificationSender = { send: async () => ({ invalidTokens: [] }) };
  const app = buildServer({
    config: getConfig({
      NODE_ENV: 'test',
      JWT_SECRET: 'notifications-test-secret-with-at-least-32-characters',
    }),
    notificationSender: noopSender,
    prisma,
    logger: false,
  });
  const suffix = randomUUID();
  const city = await prisma.city.create({
    data: { slug: `push-${suffix}`, nameRu: 'Пушград', regionRu: 'Тестовая область' },
  });
  const category = await prisma.category.create({
    data: { slug: `push-${suffix}`, nameRu: 'Push test' },
  });
  const userIds: string[] = [];
  const adIds: string[] = [];

  async function register(name: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: `${name}-${suffix}@example.test`,
        password: 'Notifications-test-2026!',
        nickname: name,
        cityId: city.id,
        language: 'ru',
        acceptedMinimumAge: true,
      },
    });
    const auth = response.json<{ accessToken: string; user: { id: string } }>();
    userIds.push(auth.user.id);
    return auth;
  }

  try {
    await app.ready();
    const user = await register('recipient');
    const stranger = await register('stranger');
    const tokenValue = `ExpoPushToken[notification_${suffix.replaceAll('-', '')}]`;

    const registered = await app.inject({
      method: 'POST',
      url: '/account/device-tokens',
      headers: { authorization: `Bearer ${user.accessToken}` },
      payload: { token: tokenValue, platform: 'android' },
    });
    assert.equal(registered.statusCode, 201);
    const tokenId = registered.json<{ deviceToken: { id: string } }>().deviceToken.id;

    const unauthorizedRemoval = await app.inject({
      method: 'DELETE',
      url: `/account/device-tokens/${tokenId}`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    assert.equal(unauthorizedRemoval.statusCode, 404);

    const requestId = 'notification-test-request';
    const live = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { 'x-request-id': requestId },
    });
    assert.equal(live.statusCode, 200);
    assert.equal(live.headers['x-request-id'], requestId);
    assert.equal((await app.inject({ method: 'GET', url: '/health/ready' })).statusCode, 200);

    const activeAd = await prisma.ad.create({
      data: {
        ownerId: user.user.id,
        categoryId: category.id,
        cityId: city.id,
        title: 'Куплю тестовый товар',
        description: 'Подробное описание тестового объявления для уведомлений.',
        budget: 5000,
        condition: 'GOOD',
        status: 'ACTIVE',
        publishedAt: new Date(),
      },
    });
    adIds.push(activeAd.id);
    const offerResponse = await app.inject({
      method: 'POST',
      url: `/ads/${activeAd.id}/offers`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
      payload: { price: 4500, description: 'PRIVATE OFFER DESCRIPTION' },
    });
    assert.equal(offerResponse.statusCode, 201);
    const offer = offerResponse.json<{ offer: { chat: { id: string }; id: string } }>().offer;
    const offerJob = await prisma.notificationJob.findUniqueOrThrow({
      where: { dedupeKey: `new-offer:${offer.id}` },
    });
    assert.doesNotMatch(JSON.stringify(offerJob.data), /PRIVATE OFFER DESCRIPTION/);

    const messageResponse = await app.inject({
      method: 'POST',
      url: `/chats/${offer.chat.id}/messages`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
      payload: { body: 'SECRET MESSAGE BODY' },
    });
    assert.equal(messageResponse.statusCode, 201);
    const messageId = messageResponse.json<{ message: { id: string } }>().message.id;
    const messageJob = await prisma.notificationJob.findUniqueOrThrow({
      where: { dedupeKey: `new-message:${messageId}` },
    });
    assert.doesNotMatch(JSON.stringify(messageJob.data), /SECRET MESSAGE BODY/);

    await prisma.user.update({ where: { id: stranger.user.id }, data: { role: UserRole.ADMIN } });
    const moderationAd = await prisma.ad.create({
      data: {
        ownerId: user.user.id,
        categoryId: category.id,
        cityId: city.id,
        title: 'Объявление на проверке',
        description: 'Подробное безопасное описание объявления на проверке.',
        condition: 'ANY',
        status: 'MODERATION',
      },
    });
    adIds.push(moderationAd.id);
    const approval = await app.inject({
      method: 'POST',
      url: `/admin/ads/${moderationAd.id}/approve`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
      payload: { note: 'PRIVATE PRIVATE MODERATION NOTE' },
    });
    assert.equal(approval.statusCode, 200);
    const moderationJob = await prisma.notificationJob.findFirstOrThrow({
      where: { recipientId: user.user.id, type: NotificationType.MODERATION_RESULT },
    });
    assert.doesNotMatch(JSON.stringify(moderationJob.data), /PRIVATE MODERATION NOTE/);

    await prisma.notificationJob.deleteMany({ where: { recipientId: user.user.id } });

    await prisma.$transaction(async (transaction) => {
      const input = {
        recipientId: user.user.id,
        type: NotificationType.NEW_MESSAGE,
        dedupeKey: `test-message:${suffix}`,
        data: { chatId: suffix, url: `/chats/${suffix}` },
      };
      await enqueueNotification(transaction, input);
      await enqueueNotification(transaction, input);
    });
    assert.equal(
      await prisma.notificationJob.count({ where: { dedupeKey: `test-message:${suffix}` } }),
      1,
    );

    const delivered: PushMessage[] = [];
    let shouldFail = true;
    const sender: NotificationSender = {
      async send(messages) {
        if (shouldFail) {
          shouldFail = false;
          throw new Error('simulated provider failure containing private chat text');
        }
        delivered.push(...messages);
        return { invalidTokens: [] };
      },
    };
    const first = await processNotificationJobs(prisma, sender);
    assert.equal(first.failed, 1);
    const failedJob = await prisma.notificationJob.findUniqueOrThrow({
      where: { dedupeKey: `test-message:${suffix}` },
    });
    assert.equal(failedJob.status, 'FAILED');
    assert.equal(failedJob.lastError, 'Push provider unavailable.');

    await prisma.notificationJob.update({
      where: { id: failedJob.id },
      data: { nextAttemptAt: new Date(0) },
    });
    const retry = await processNotificationJobs(prisma, sender);
    assert.equal(retry.sent, 1);
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0]?.body, 'У вас новое сообщение в Doska.');
    assert.doesNotMatch(JSON.stringify(delivered[0]), /private chat text/i);

    const expiringAd = await prisma.ad.create({
      data: {
        ownerId: user.user.id,
        categoryId: category.id,
        cityId: city.id,
        title: 'Тестовое объявление',
        description: 'Описание объявления для проверки уведомления.',
        condition: 'ANY',
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    adIds.push(expiringAd.id);
    await enqueueExpiringAdNotifications(prisma);
    await enqueueExpiringAdNotifications(prisma);
    assert.equal(
      await prisma.notificationJob.count({
        where: { recipientId: user.user.id, type: NotificationType.AD_EXPIRING },
      }),
      1,
    );
  } finally {
    await prisma.notificationJob.deleteMany({ where: { recipientId: { in: userIds } } });
    await prisma.deviceToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.ad.deleteMany({ where: { id: { in: adIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.city.delete({ where: { id: city.id } });
    await app.close();
  }
});
