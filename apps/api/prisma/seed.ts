import { PrismaClient } from '@prisma/client';

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

  console.log(`Seeded ${categorySeeds.length} categories and ${citySeeds.length} cities.`);
}

seed()
  .catch((error: unknown) => {
    console.error('Database seed failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
