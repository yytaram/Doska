import {
  AdStatus,
  ItemCondition,
  Prisma,
  PrismaClient,
  type Category,
  type City,
} from '@prisma/client';
import type { FastifyInstance, FastifyReply } from 'fastify';

import { createAuthenticate, requireAccount } from '../auth/guard.js';
import { parseBody, sendError } from '../http-errors.js';
import { decodeAdCursor, encodeAdCursor, type AdCursor } from './cursor.js';
import {
  adParamsSchema,
  createAdSchema,
  myAdsQuerySchema,
  publicAdsQuerySchema,
  updateAdSchema,
  type AdStatusInput,
  type ItemConditionInput,
} from './schemas.js';
import { adSelect, serializeAd } from './serializer.js';

const conditionToDatabase: Record<ItemConditionInput, ItemCondition> = {
  any: ItemCondition.ANY,
  new: ItemCondition.NEW,
  like_new: ItemCondition.LIKE_NEW,
  good: ItemCondition.GOOD,
  fair: ItemCondition.FAIR,
  for_parts: ItemCondition.FOR_PARTS,
};

const statusToDatabase: Record<AdStatusInput, AdStatus> = {
  draft: AdStatus.DRAFT,
  moderation: AdStatus.MODERATION,
  active: AdStatus.ACTIVE,
  paused: AdStatus.PAUSED,
  closed: AdStatus.CLOSED,
  rejected: AdStatus.REJECTED,
  expired: AdStatus.EXPIRED,
};

class AdStateChangedError extends Error {}

function toFullTextQuery(value: string) {
  return value
    .toLocaleLowerCase('ru')
    .match(/[\p{L}\p{N}]+/gu)
    ?.map((term) => `${term}:*`)
    .join(' & ');
}

function notFound(reply: FastifyReply) {
  return sendError(reply, 404, 'AD_NOT_FOUND', 'Объявление не найдено.');
}

function cursorFilter(cursor: AdCursor): Prisma.AdWhereInput {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

function parseCursor(value: string | undefined, reply: FastifyReply): AdCursor | undefined | null {
  if (!value) return undefined;

  const cursor = decodeAdCursor(value);
  if (!cursor) {
    sendError(reply, 400, 'INVALID_CURSOR', 'Некорректный курсор страницы.');
    return null;
  }

  return cursor;
}

function paginatedAds(ads: Array<Parameters<typeof serializeAd>[0]>, limit: number) {
  const hasMore = ads.length > limit;
  const page = hasMore ? ads.slice(0, limit) : ads;
  const last = page.at(-1);

  return {
    items: page.map(serializeAd),
    nextCursor: hasMore && last ? encodeAdCursor(last) : null,
  };
}

async function activeReferences(
  prisma: PrismaClient,
  categoryId: string,
  cityId: string,
): Promise<{ category: Pick<Category, 'id'> | null; city: Pick<City, 'id'> | null }> {
  const [category, city] = await Promise.all([
    prisma.category.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } }),
    prisma.city.findFirst({ where: { id: cityId, isActive: true }, select: { id: true } }),
  ]);

  return { category, city };
}

async function validateReferences(
  prisma: PrismaClient,
  reply: FastifyReply,
  categoryId: string,
  cityId: string,
) {
  const references = await activeReferences(prisma, categoryId, cityId);
  if (!references.category) {
    sendError(reply, 400, 'INVALID_CATEGORY', 'Выберите доступную категорию.');
    return false;
  }
  if (!references.city) {
    sendError(reply, 400, 'INVALID_CITY', 'Выберите доступный город.');
    return false;
  }
  return true;
}

export function registerAdRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const authenticate = createAuthenticate(prisma);

  app.get(
    '/ads',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const query = parseBody(publicAdsQuerySchema, request.query, reply);
      if (!query) return;

      const cursor = parseCursor(query.cursor, reply);
      if (cursor === null) return;

      const now = new Date();
      const search = query.search ? toFullTextQuery(query.search) : undefined;
      const budgetFilter =
        query.budgetMin !== undefined || query.budgetMax !== undefined
          ? {
              budget: {
                not: null,
                ...(query.budgetMin !== undefined ? { gte: query.budgetMin } : {}),
                ...(query.budgetMax !== undefined ? { lte: query.budgetMax } : {}),
              },
            }
          : {};
      const where: Prisma.AdWhereInput = {
        status: AdStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(search
          ? {
              AND: [
                ...(cursor ? [cursorFilter(cursor)] : []),
                {
                  OR: [{ title: { search } }, { description: { search } }],
                },
              ],
            }
          : cursor
            ? { AND: [cursorFilter(cursor)] }
            : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.cityId ? { cityId: query.cityId } : {}),
        ...(query.condition ? { condition: conditionToDatabase[query.condition] } : {}),
        ...budgetFilter,
        ...(query.publishedAfter || query.publishedBefore
          ? {
              publishedAt: {
                ...(query.publishedAfter ? { gte: query.publishedAfter } : {}),
                ...(query.publishedBefore ? { lte: query.publishedBefore } : {}),
              },
            }
          : {}),
      };
      const ads = await prisma.ad.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: adSelect,
      });

      return paginatedAds(ads, query.limit);
    },
  );

  app.get(
    '/ads/:id',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const params = parseBody(adParamsSchema, request.params, reply);
      if (!params) return;

      const ad = await prisma.ad.findFirst({
        where: {
          id: params.id,
          status: AdStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: adSelect,
      });

      if (!ad) return notFound(reply);
      return { ad: serializeAd(ad) };
    },
  );

  app.post(
    '/ads',
    {
      onRequest: authenticate,
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const account = requireAccount(request);
      const body = parseBody(createAdSchema, request.body, reply);
      if (!body) return;

      if (!(await validateReferences(prisma, reply, body.categoryId, body.cityId))) return;

      const status = statusToDatabase[body.status];
      const ad = await prisma.$transaction(async (transaction) => {
        const created = await transaction.ad.create({
          data: {
            ownerId: account.id,
            categoryId: body.categoryId,
            cityId: body.cityId,
            title: body.title,
            description: body.description,
            budget: body.budget,
            currency: 'KZT',
            condition: conditionToDatabase[body.condition],
            status,
          },
          select: adSelect,
        });
        await transaction.auditLog.create({
          data: {
            actorId: account.id,
            action: 'ad.created',
            entityType: 'ad',
            entityId: created.id,
            metadata: { status: body.status },
          },
        });
        return created;
      });

      return reply.code(201).send({ ad: serializeAd(ad) });
    },
  );

  app.get(
    '/account/ads',
    {
      onRequest: authenticate,
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const account = requireAccount(request);
      const query = parseBody(myAdsQuerySchema, request.query, reply);
      if (!query) return;

      const cursor = parseCursor(query.cursor, reply);
      if (cursor === null) return;

      const ads = await prisma.ad.findMany({
        where: {
          ownerId: account.id,
          ...(query.status ? { status: statusToDatabase[query.status] } : {}),
          ...(cursor ? { AND: [cursorFilter(cursor)] } : {}),
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: adSelect,
      });

      return paginatedAds(ads, query.limit);
    },
  );

  app.get(
    '/account/ads/:id',
    {
      onRequest: authenticate,
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(adParamsSchema, request.params, reply);
      if (!params) return;

      const ad = await prisma.ad.findFirst({
        where: { id: params.id, ownerId: account.id },
        select: adSelect,
      });

      if (!ad) return notFound(reply);
      return { ad: serializeAd(ad) };
    },
  );

  app.patch(
    '/ads/:id',
    {
      onRequest: authenticate,
      config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(adParamsSchema, request.params, reply);
      if (!params) return;
      const body = parseBody(updateAdSchema, request.body, reply);
      if (!body) return;

      const current = await prisma.ad.findFirst({
        where: { id: params.id, ownerId: account.id },
        select: { id: true, categoryId: true, cityId: true, status: true },
      });
      if (!current) return notFound(reply);
      if (current.status === AdStatus.CLOSED || current.status === AdStatus.EXPIRED) {
        return sendError(
          reply,
          409,
          'AD_NOT_EDITABLE',
          'Закрытое или истёкшее объявление нельзя изменить.',
        );
      }

      const categoryId = body.categoryId ?? current.categoryId;
      const cityId = body.cityId ?? current.cityId;
      if (!(await validateReferences(prisma, reply, categoryId, cityId))) return;

      const defaultStatus =
        current.status === AdStatus.ACTIVE ||
        current.status === AdStatus.PAUSED ||
        current.status === AdStatus.MODERATION
          ? AdStatus.MODERATION
          : AdStatus.DRAFT;
      const status = body.status ? statusToDatabase[body.status] : defaultStatus;

      let ad: Parameters<typeof serializeAd>[0];
      try {
        ad = await prisma.$transaction(async (transaction) => {
          const result = await transaction.ad.updateMany({
            where: {
              id: current.id,
              ownerId: account.id,
              status: { notIn: [AdStatus.CLOSED, AdStatus.EXPIRED] },
            },
            data: {
              ...(body.title !== undefined ? { title: body.title } : {}),
              ...(body.description !== undefined ? { description: body.description } : {}),
              ...(body.budget !== undefined ? { budget: body.budget } : {}),
              ...(body.condition !== undefined
                ? { condition: conditionToDatabase[body.condition] }
                : {}),
              categoryId,
              cityId,
              status,
            },
          });
          if (result.count !== 1) throw new AdStateChangedError();

          const updated = await transaction.ad.findUniqueOrThrow({
            where: { id: current.id },
            select: adSelect,
          });
          await transaction.auditLog.create({
            data: {
              actorId: account.id,
              action: 'ad.updated',
              entityType: 'ad',
              entityId: current.id,
              metadata: { status: status.toLowerCase() },
            },
          });
          return updated;
        });
      } catch (error: unknown) {
        if (error instanceof AdStateChangedError) {
          return sendError(reply, 409, 'AD_STATE_CHANGED', 'Состояние объявления изменилось.');
        }
        throw error;
      }

      return { ad: serializeAd(ad) };
    },
  );

  app.post(
    '/ads/:id/pause',
    {
      onRequest: authenticate,
      config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(adParamsSchema, request.params, reply);
      if (!params) return;

      const current = await prisma.ad.findFirst({
        where: { id: params.id, ownerId: account.id },
        select: { id: true, status: true },
      });
      if (!current) return notFound(reply);
      if (current.status !== AdStatus.ACTIVE) {
        return sendError(
          reply,
          409,
          'INVALID_AD_TRANSITION',
          'Приостановить можно только активное объявление.',
        );
      }

      let ad: Parameters<typeof serializeAd>[0];
      try {
        ad = await prisma.$transaction(async (transaction) => {
          const result = await transaction.ad.updateMany({
            where: { id: current.id, ownerId: account.id, status: AdStatus.ACTIVE },
            data: { status: AdStatus.PAUSED },
          });
          if (result.count !== 1) throw new AdStateChangedError();

          const paused = await transaction.ad.findUniqueOrThrow({
            where: { id: current.id },
            select: adSelect,
          });
          await transaction.auditLog.create({
            data: {
              actorId: account.id,
              action: 'ad.paused',
              entityType: 'ad',
              entityId: current.id,
            },
          });
          return paused;
        });
      } catch (error: unknown) {
        if (error instanceof AdStateChangedError) {
          return sendError(reply, 409, 'AD_STATE_CHANGED', 'Состояние объявления изменилось.');
        }
        throw error;
      }

      return { ad: serializeAd(ad) };
    },
  );

  app.post(
    '/ads/:id/resume',
    {
      onRequest: authenticate,
      config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(adParamsSchema, request.params, reply);
      if (!params) return;

      const current = await prisma.ad.findFirst({
        where: { id: params.id, ownerId: account.id },
        select: { id: true, status: true },
      });
      if (!current) return notFound(reply);
      if (current.status !== AdStatus.PAUSED) {
        return sendError(
          reply,
          409,
          'INVALID_AD_TRANSITION',
          'Возобновить можно только приостановленное объявление.',
        );
      }

      let ad: Parameters<typeof serializeAd>[0];
      try {
        ad = await prisma.$transaction(async (transaction) => {
          const result = await transaction.ad.updateMany({
            where: { id: current.id, ownerId: account.id, status: AdStatus.PAUSED },
            data: { status: AdStatus.MODERATION },
          });
          if (result.count !== 1) throw new AdStateChangedError();

          const resumed = await transaction.ad.findUniqueOrThrow({
            where: { id: current.id },
            select: adSelect,
          });
          await transaction.auditLog.create({
            data: {
              actorId: account.id,
              action: 'ad.resubmitted',
              entityType: 'ad',
              entityId: current.id,
            },
          });
          return resumed;
        });
      } catch (error: unknown) {
        if (error instanceof AdStateChangedError) {
          return sendError(reply, 409, 'AD_STATE_CHANGED', 'Состояние объявления изменилось.');
        }
        throw error;
      }

      return { ad: serializeAd(ad) };
    },
  );

  app.post(
    '/ads/:id/close',
    {
      onRequest: authenticate,
      config: { rateLimit: { max: 30, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const account = requireAccount(request);
      const params = parseBody(adParamsSchema, request.params, reply);
      if (!params) return;

      const current = await prisma.ad.findFirst({
        where: { id: params.id, ownerId: account.id },
        select: { id: true, status: true },
      });
      if (!current) return notFound(reply);

      const ad = await prisma.$transaction(async (transaction) => {
        const result = await transaction.ad.updateMany({
          where: { id: current.id, ownerId: account.id, status: { not: AdStatus.CLOSED } },
          data: {
            status: AdStatus.CLOSED,
            closedAt: new Date(),
          },
        });
        const closed = await transaction.ad.findUniqueOrThrow({
          where: { id: current.id },
          select: adSelect,
        });

        if (result.count === 1) {
          await transaction.auditLog.create({
            data: {
              actorId: account.id,
              action: 'ad.closed',
              entityType: 'ad',
              entityId: current.id,
            },
          });
        }
        return closed;
      });

      return { ad: serializeAd(ad) };
    },
  );
}
