import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { PrismaClient } from '@prisma/client';

import { categorySeeds, citySeeds } from '../prisma/seed-data.js';

const prisma = new PrismaClient();

test.after(async () => {
  await prisma.$disconnect();
});

test('reference data contains unique starter categories and all 90 cities', () => {
  assert.equal(categorySeeds.length, 8);
  assert.equal(citySeeds.length, 90);
  assert.equal(new Set(categorySeeds.map(({ slug }) => slug)).size, categorySeeds.length);
  assert.equal(new Set(citySeeds.map(({ slug }) => slug)).size, citySeeds.length);
  assert.equal(new Set(citySeeds.map(({ nameRu }) => nameRu)).size, citySeeds.length);
});

test('seeded database contains the complete reference catalog', async () => {
  assert.equal(await prisma.category.count(), 8);
  assert.equal(await prisma.city.count(), 90);
});

test('database enforces offer ownership and relationship constraints', async () => {
  const suffix = randomUUID();
  const category = await prisma.category.findFirstOrThrow({ orderBy: { position: 'asc' } });
  const city = await prisma.city.findFirstOrThrow({ orderBy: { nameRu: 'asc' } });
  const owner = await prisma.user.create({
    data: {
      email: `owner-${suffix}@example.test`,
      passwordHash: 'not-a-real-password-hash',
    },
  });
  const seller = await prisma.user.create({
    data: {
      email: `seller-${suffix}@example.test`,
      passwordHash: 'not-a-real-password-hash',
    },
  });
  const ad = await prisma.ad.create({
    data: {
      ownerId: owner.id,
      categoryId: category.id,
      cityId: city.id,
      title: 'Тестовое объявление',
      description: 'Создано только для проверки ограничений базы данных.',
    },
  });

  try {
    await assert.rejects(
      prisma.offer.create({
        data: {
          adId: ad.id,
          senderId: owner.id,
          description: 'Владелец не может предложить товар самому себе.',
        },
      }),
    );

    await prisma.offer.create({
      data: {
        adId: ad.id,
        senderId: seller.id,
        price: 1000,
        description: 'Допустимое тестовое предложение.',
      },
    });

    await assert.rejects(
      prisma.offer.create({
        data: {
          adId: ad.id,
          senderId: seller.id,
          description: 'Повторное предложение того же продавца.',
        },
      }),
    );

    await assert.rejects(
      prisma.ad.update({
        where: { id: ad.id },
        data: { ownerId: seller.id },
      }),
    );

    await assert.rejects(
      prisma.block.create({
        data: { blockerId: owner.id, blockedId: owner.id },
      }),
    );

    await assert.rejects(
      prisma.report.create({
        data: {
          reporterId: owner.id,
          targetType: 'USER',
          reason: 'invalid-test-report',
        },
      }),
    );
  } finally {
    await prisma.offer.deleteMany({ where: { adId: ad.id } });
    await prisma.ad.delete({ where: { id: ad.id } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, seller.id] } } });
  }
});
