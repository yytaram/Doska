import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { PrismaClient, UserRole } from '@prisma/client';

import { getConfig } from '../config.js';
import { buildServer } from '../server.js';

test('moderation and reports are staff-only, actionable and audited', async () => {
  const prisma = new PrismaClient();
  const app = buildServer({
    config: getConfig({
      NODE_ENV: 'test',
      JWT_SECRET: 'moderation-test-secret-with-at-least-32-chars',
    }),
    prisma,
    logger: false,
  });
  const suffix = randomUUID();
  const category = await prisma.category.create({
    data: { slug: `moderation-${suffix}`, nameRu: 'Модерация' },
  });
  const city = await prisma.city.create({
    data: { slug: `moderation-${suffix}`, nameRu: 'Тестоград', regionRu: 'Тестовая область' },
  });
  const userIds: string[] = [];
  const adIds: string[] = [];

  async function register(name: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: `${name}-${suffix}@example.test`,
        password: 'Moderation-test-2026!',
        nickname: name,
        cityId: city.id,
        language: 'ru',
        acceptedMinimumAge: true,
      },
    });
    assert.equal(response.statusCode, 201);
    const auth = response.json<{ accessToken: string; user: { id: string } }>();
    userIds.push(auth.user.id);
    return auth;
  }

  try {
    await app.ready();
    const owner = await register('owner');
    const reporter = await register('reporter');
    const admin = await register('admin');
    await prisma.user.update({ where: { id: admin.user.id }, data: { role: UserRole.ADMIN } });

    const forbidden = await app.inject({
      method: 'GET',
      url: '/admin/ads',
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    assert.equal(forbidden.statusCode, 403);

    const termResponse = await app.inject({
      method: 'POST',
      url: '/admin/moderation-terms',
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { term: 'оружие', severity: 'block' },
    });
    assert.equal(termResponse.statusCode, 201);
    const termId = termResponse.json<{ term: { id: string } }>().term.id;

    const blockedResponse = await app.inject({
      method: 'POST',
      url: '/ads',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        title: 'Куплю ОРУЖИЕ!!!',
        description: 'Подробное тестовое описание запрещённого товара.',
        budget: 10,
        condition: 'any',
        categoryId: category.id,
        cityId: city.id,
        status: 'moderation',
      },
    });
    assert.equal(blockedResponse.statusCode, 201);
    const blocked = blockedResponse.json<{ ad: { id: string; status: string } }>().ad;
    adIds.push(blocked.id);
    assert.equal(blocked.status, 'rejected');
    const evidence = await prisma.ad.findUniqueOrThrow({
      where: { id: blocked.id },
      select: { moderationMatches: true },
    });
    assert.match(JSON.stringify(evidence.moderationMatches), /оружие/i);

    const reviewResponse = await app.inject({
      method: 'POST',
      url: '/ads',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        title: 'Куплю обычный товар',
        description: 'Подробное безопасное описание обычного товара.',
        budget: 1000,
        condition: 'good',
        categoryId: category.id,
        cityId: city.id,
        status: 'moderation',
      },
    });
    const reviewAd = reviewResponse.json<{ ad: { id: string; status: string } }>().ad;
    adIds.push(reviewAd.id);
    assert.equal(reviewAd.status, 'moderation');

    const approve = await app.inject({
      method: 'POST',
      url: `/admin/ads/${reviewAd.id}/approve`,
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { note: 'Проверено вручную' },
    });
    assert.equal(approve.statusCode, 200);
    assert.equal(approve.json<{ ad: { status: string } }>().ad.status, 'active');

    const reportResponse = await app.inject({
      method: 'POST',
      url: '/reports',
      headers: { authorization: `Bearer ${reporter.accessToken}` },
      payload: {
        targetType: 'ad',
        targetId: reviewAd.id,
        reason: 'Запрещённый товар',
        details: 'Прошу проверить объявление.',
      },
    });
    assert.equal(reportResponse.statusCode, 201);
    const reportId = reportResponse.json<{ report: { id: string } }>().report.id;

    const resolve = await app.inject({
      method: 'POST',
      url: `/admin/reports/${reportId}/review`,
      headers: { authorization: `Bearer ${admin.accessToken}` },
      payload: { status: 'resolved', note: 'Скрыто до дополнительной проверки', hideAd: true },
    });
    assert.equal(resolve.statusCode, 200);
    assert.equal(
      (await prisma.ad.findUniqueOrThrow({ where: { id: reviewAd.id } })).status,
      'PAUSED',
    );

    const actions = await prisma.auditLog.findMany({
      where: { actorId: admin.user.id },
      select: { action: true },
    });
    assert.ok(actions.some(({ action }) => action === 'admin.moderation_term.created'));
    assert.ok(actions.some(({ action }) => action === 'admin.ad.approved'));
    assert.ok(actions.some(({ action }) => action === 'admin.ad.hidden_from_report'));
    assert.ok(actions.some(({ action }) => action === 'admin.report.reviewed'));

    await prisma.moderationTerm.delete({ where: { id: termId } });
  } finally {
    await prisma.report.deleteMany({ where: { reporterId: { in: userIds } } });
    await prisma.ad.deleteMany({ where: { id: { in: adIds } } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.category.delete({ where: { id: category.id } });
    await prisma.city.delete({ where: { id: city.id } });
    await app.close();
  }
});
