import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { PrismaClient } from '@prisma/client';

import { getConfig } from '../config.js';
import { buildServer } from '../server.js';

interface AuthResponse {
  accessToken: string;
  user: { id: string };
}

interface AdResponse {
  ad: {
    id: string;
    budget: number | null;
    condition: string;
    currency: string;
    status: string;
    title: string;
  };
}

interface AdPage {
  items: AdResponse['ad'][];
  nextCursor: string | null;
}

const testPassword = 'Ads-test-password-2026!';

test('ads API enforces ownership, public states and keyset cursor pagination', async () => {
  const prisma = new PrismaClient();
  const config = getConfig({
    NODE_ENV: 'test',
    JWT_SECRET: 'ads-test-jwt-secret-with-at-least-32-characters',
  });
  const app = buildServer({ config, prisma, logger: false });
  const suffix = randomUUID();
  const category = await prisma.category.create({
    data: { slug: `test-category-${suffix}`, nameRu: 'Тестовая категория', position: 999 },
  });
  const city = await prisma.city.create({
    data: { slug: `test-city-${suffix}`, nameRu: 'Тестовый город', regionRu: 'Тестовый регион' },
  });
  const userIds: string[] = [];
  const adIds: string[] = [];

  async function register(emailPrefix: string) {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email: `${emailPrefix}-${suffix}@example.test`,
        password: testPassword,
        nickname: emailPrefix === 'owner' ? 'Владелец' : 'Другой пользователь',
        cityId: city.id,
        language: 'ru',
        acceptedMinimumAge: true,
      },
    });
    assert.equal(response.statusCode, 201);
    const auth = response.json<AuthResponse>();
    userIds.push(auth.user.id);
    return auth;
  }

  async function createAd(
    accessToken: string,
    title: string,
    status: 'draft' | 'moderation' = 'draft',
  ) {
    const response = await app.inject({
      method: 'POST',
      url: '/ads',
      headers: { authorization: `Bearer ${accessToken}` },
      payload: {
        title,
        description: `Подробное описание для объявления «${title}».`,
        budget: 250000,
        condition: 'good',
        categoryId: category.id,
        cityId: city.id,
        status,
      },
    });
    assert.equal(response.statusCode, 201);
    const ad = response.json<AdResponse>().ad;
    adIds.push(ad.id);
    return ad;
  }

  try {
    await app.ready();
    const owner = await register('owner');
    const stranger = await register('stranger');

    const anonymousCreate = await app.inject({
      method: 'POST',
      url: '/ads',
      payload: {
        title: 'Недоступное объявление',
        description: 'Неавторизованный пользователь не может создать объявление.',
        budget: 1000,
        condition: 'any',
        categoryId: category.id,
        cityId: city.id,
      },
    });
    assert.equal(anonymousCreate.statusCode, 401);

    const invalidBudget = await app.inject({
      method: 'POST',
      url: '/ads',
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: {
        title: 'Дробный бюджет',
        description: 'Дробная сумма не разрешена для бюджета в тенге.',
        budget: 1000.5,
        condition: 'any',
        categoryId: category.id,
        cityId: city.id,
      },
    });
    assert.equal(invalidBudget.statusCode, 400);

    const first = await createAd(owner.accessToken, 'Куплю первый телефон');
    const second = await createAd(owner.accessToken, 'Куплю второй телефон', 'moderation');
    const third = await createAd(owner.accessToken, 'Куплю третий телефон');
    const privateDraft = await createAd(owner.accessToken, 'Скрытый черновик');
    const expired = await createAd(owner.accessToken, 'Истёкшее объявление');

    assert.equal(first.currency, 'KZT');
    assert.equal(first.budget, 250000);
    assert.equal(first.condition, 'good');
    assert.equal(first.status, 'draft');
    assert.equal(second.status, 'moderation');

    const baseTime = Date.now() - 60_000;
    await Promise.all(
      [first, second, third].map((ad, index) =>
        prisma.ad.update({
          where: { id: ad.id },
          data: {
            status: 'ACTIVE',
            publishedAt: new Date(baseTime + index * 1_000),
            createdAt: new Date(baseTime + index * 1_000),
          },
        }),
      ),
    );
    await prisma.ad.update({
      where: { id: expired.id },
      data: {
        status: 'ACTIVE',
        publishedAt: new Date(baseTime - 2_000),
        expiresAt: new Date(baseTime - 1_000),
      },
    });

    const publicFirstPage = await app.inject({
      method: 'GET',
      url: `/ads?limit=2&categoryId=${category.id}&cityId=${city.id}`,
    });
    assert.equal(publicFirstPage.statusCode, 200);
    const pageOne = publicFirstPage.json<AdPage>();
    assert.equal(pageOne.items.length, 2);
    assert.ok(pageOne.nextCursor);
    assert.ok(pageOne.items.every(({ status }) => status === 'active'));

    const publicSecondPage = await app.inject({
      method: 'GET',
      url: `/ads?limit=2&categoryId=${category.id}&cityId=${city.id}&cursor=${encodeURIComponent(pageOne.nextCursor!)}`,
    });
    assert.equal(publicSecondPage.statusCode, 200);
    const pageTwo = publicSecondPage.json<AdPage>();
    assert.equal(pageTwo.items.length, 1);
    assert.equal(pageTwo.nextCursor, null);

    const pagedIds = [...pageOne.items, ...pageTwo.items].map(({ id }) => id);
    assert.deepEqual(new Set(pagedIds), new Set([first.id, second.id, third.id]));
    assert.ok(!pagedIds.includes(privateDraft.id));
    assert.ok(!pagedIds.includes(expired.id));

    const activeDetail = await app.inject({ method: 'GET', url: `/ads/${first.id}` });
    assert.equal(activeDetail.statusCode, 200);
    const draftDetail = await app.inject({ method: 'GET', url: `/ads/${privateDraft.id}` });
    assert.equal(draftDetail.statusCode, 404);

    const strangerRead = await app.inject({
      method: 'GET',
      url: `/account/ads/${first.id}`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    assert.equal(strangerRead.statusCode, 404);

    const strangerUpdate = await app.inject({
      method: 'PATCH',
      url: `/ads/${first.id}`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
      payload: { title: 'Чужое изменение' },
    });
    assert.equal(strangerUpdate.statusCode, 404);

    const strangerClose = await app.inject({
      method: 'POST',
      url: `/ads/${first.id}/close`,
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    assert.equal(strangerClose.statusCode, 404);

    const ownerUpdate = await app.inject({
      method: 'PATCH',
      url: `/ads/${first.id}`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
      payload: { title: 'Куплю обновлённый первый телефон' },
    });
    assert.equal(ownerUpdate.statusCode, 200);
    assert.equal(ownerUpdate.json<AdResponse>().ad.status, 'moderation');

    const updatedPublicDetail = await app.inject({ method: 'GET', url: `/ads/${first.id}` });
    assert.equal(updatedPublicDetail.statusCode, 404);

    const pause = await app.inject({
      method: 'POST',
      url: `/ads/${second.id}/pause`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    assert.equal(pause.statusCode, 200);
    assert.equal(pause.json<AdResponse>().ad.status, 'paused');

    const resume = await app.inject({
      method: 'POST',
      url: `/ads/${second.id}/resume`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    assert.equal(resume.statusCode, 200);
    assert.equal(resume.json<AdResponse>().ad.status, 'moderation');

    const close = await app.inject({
      method: 'POST',
      url: `/ads/${third.id}/close`,
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    assert.equal(close.statusCode, 200);
    assert.equal(close.json<AdResponse>().ad.status, 'closed');

    const privateList = await app.inject({
      method: 'GET',
      url: '/account/ads?limit=2',
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    assert.equal(privateList.statusCode, 200);
    assert.equal(privateList.json<AdPage>().items.length, 2);
    assert.ok(privateList.json<AdPage>().nextCursor);

    const closedList = await app.inject({
      method: 'GET',
      url: '/account/ads?status=closed',
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    assert.equal(closedList.statusCode, 200);
    assert.deepEqual(
      closedList.json<AdPage>().items.map(({ id }) => id),
      [third.id],
    );

    const invalidCursor = await app.inject({ method: 'GET', url: '/ads?cursor=not-a-cursor' });
    assert.equal(invalidCursor.statusCode, 400);

    const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'ads'
    `;
    const indexNames = new Set(indexes.map(({ indexname }) => indexname));
    assert.ok(indexNames.has('ads_status_created_at_id_idx'));
    assert.ok(indexNames.has('ads_owner_id_created_at_id_idx'));
    assert.ok(indexNames.has('ads_owner_id_status_created_at_id_idx'));
  } finally {
    if (userIds.length > 0) {
      await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
      await prisma.offer.deleteMany({ where: { senderId: { in: userIds } } });
      await prisma.ad.deleteMany({ where: { ownerId: { in: userIds } } });
      await prisma.report.deleteMany({ where: { reporterId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.category.deleteMany({ where: { id: category.id } });
    await prisma.city.deleteMany({ where: { id: city.id } });
    await app.close();
  }
});
