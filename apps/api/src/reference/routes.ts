import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

export function registerReferenceRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get('/reference/cities', async () => ({
    cities: await prisma.city.findMany({
      where: { isActive: true },
      orderBy: [{ regionRu: 'asc' }, { nameRu: 'asc' }],
      select: {
        id: true,
        slug: true,
        nameRu: true,
        regionRu: true,
      },
    }),
  }));
}
