import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/auth/passwords.js';
import { categorySeeds, citySeeds } from './seed-data.js';

const prisma = new PrismaClient();

async function seed() {
  await prisma.$transaction([
    ...categorySeeds.map((category) =>
      prisma.category.upsert({
        where: { slug: category.slug },
        update: {
          nameRu: category.nameRu,
          position: category.position,
          isActive: true,
        },
        create: category,
      }),
    ),
    ...citySeeds.map((city) =>
      prisma.city.upsert({
        where: { slug: city.slug },
        update: {
          nameRu: city.nameRu,
          regionRu: city.regionRu,
          isActive: true,
        },
        create: city,
      }),
    ),
  ]);

  const [almaty, astana, phones, home, sports] = await Promise.all([
    prisma.city.findUniqueOrThrow({ where: { slug: 'almaty' } }),
    prisma.city.findUniqueOrThrow({ where: { slug: 'astana' } }),
    prisma.category.findUniqueOrThrow({ where: { slug: 'phones-computers' } }),
    prisma.category.findUniqueOrThrow({ where: { slug: 'home-furniture' } }),
    prisma.category.findUniqueOrThrow({ where: { slug: 'sports-hobbies' } }),
  ]);
  const demoEmail = 'demo.buyer@doska.local';
  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      status: 'ACTIVE',
      profile: {
        upsert: {
          create: { cityId: almaty.id, language: 'ru', nickname: 'Демо-покупатель' },
          update: { cityId: almaty.id, language: 'ru', nickname: 'Демо-покупатель' },
        },
      },
    },
    create: {
      email: demoEmail,
      passwordHash: await hashPassword('Doska-demo-password-2026!'),
      profile: { create: { cityId: almaty.id, language: 'ru', nickname: 'Демо-покупатель' } },
    },
  });
  const demoAds = [
    {
      id: '00000000-0000-4000-8000-000000000701',
      title: 'Куплю iPhone 15 Pro 256 ГБ',
      description:
        'Ищу iPhone 15 Pro на 256 ГБ в хорошем состоянии, без серьёзных повреждений и ремонтов.',
      budget: 420000,
      condition: 'GOOD' as const,
      categoryId: phones.id,
      cityId: almaty.id,
    },
    {
      id: '00000000-0000-4000-8000-000000000702',
      title: 'Нужен письменный стол для дома',
      description:
        'Куплю устойчивый письменный стол шириной от 120 см. Рассмотрю доставку по Астане.',
      budget: 80000,
      condition: 'LIKE_NEW' as const,
      categoryId: home.id,
      cityId: astana.id,
    },
    {
      id: '00000000-0000-4000-8000-000000000703',
      title: 'Куплю городской велосипед',
      description: 'Ищу взрослый городской велосипед в рабочем состоянии, желательно с багажником.',
      budget: 120000,
      condition: 'FAIR' as const,
      categoryId: sports.id,
      cityId: almaty.id,
    },
  ];
  const publishedAt = new Date();
  await prisma.$transaction(
    demoAds.map((ad) =>
      prisma.ad.upsert({
        where: { id: ad.id },
        update: { ...ad, ownerId: demoUser.id, publishedAt, status: 'ACTIVE' },
        create: { ...ad, ownerId: demoUser.id, publishedAt, status: 'ACTIVE' },
      }),
    ),
  );

  console.log(
    `Seeded ${categorySeeds.length} categories, ${citySeeds.length} cities and ${demoAds.length} demo ads.`,
  );
}

seed()
  .catch((error: unknown) => {
    console.error('Database seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
