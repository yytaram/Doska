import {
  AdStatus,
  ModerationSeverity,
  PrismaClient,
  ReportStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { createRequireStaff, requireAccount } from '../auth/guard.js';
import { parseBody, sendError } from '../http-errors.js';
import { normalizeModerationText } from '../moderation/service.js';

const idParams = z.object({ id: z.string().uuid() });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50) });
const noteBody = z.object({ note: z.string().trim().min(3).max(2000) });
const reportBody = z.object({
  status: z.enum(['reviewing', 'resolved', 'dismissed']),
  note: z.string().trim().min(3).max(2000),
  hideAd: z.boolean().default(false),
});
const categoryBody = z.object({
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  nameRu: z.string().trim().min(2).max(100),
  position: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});
const categoryPatch = categoryBody.partial().refine((body) => Object.keys(body).length > 0);
const termBody = z.object({
  term: z.string().trim().min(2).max(200),
  severity: z.enum(['review', 'block']).default('review'),
});
const termPatch = z
  .object({
    term: z.string().trim().min(2).max(200).optional(),
    severity: z.enum(['review', 'block']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0);

function requireAdmin(reply: FastifyReply, role: string) {
  if (role === UserRole.ADMIN) return true;
  sendError(reply, 403, 'ADMIN_REQUIRED', 'Это действие доступно только администратору.');
  return false;
}

function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: object,
) {
  return { actorId, action, entityType, entityId, ...(metadata ? { metadata } : {}) };
}

export function registerAdminRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const requireStaff = createRequireStaff(prisma);
  const staffOptions = {
    onRequest: requireStaff,
    config: { rateLimit: { max: 240, timeWindow: '1 minute' } },
  };

  app.get('/admin/me', staffOptions, async (request) => ({ admin: requireAccount(request) }));

  app.get('/admin/overview', staffOptions, async () => {
    const [moderationAds, openReports, activeUsers] = await Promise.all([
      prisma.ad.count({ where: { status: AdStatus.MODERATION } }),
      prisma.report.count({
        where: { status: { in: [ReportStatus.OPEN, ReportStatus.REVIEWING] } },
      }),
      prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
    ]);
    return { moderationAds, openReports, activeUsers };
  });

  app.get('/admin/ads', staffOptions, async (request, reply) => {
    const query = parseBody(
      listQuery.extend({
        status: z.enum(['moderation', 'active', 'paused', 'rejected']).optional(),
      }),
      request.query,
      reply,
    );
    if (!query) return;
    const ads = await prisma.ad.findMany({
      where: query.status ? { status: query.status.toUpperCase() as AdStatus } : undefined,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        moderationMatches: true,
        moderationNote: true,
        createdAt: true,
        owner: { select: { email: true, profile: { select: { nickname: true } } } },
        category: { select: { nameRu: true } },
        city: { select: { nameRu: true } },
      },
    });
    return { items: ads.map((ad) => ({ ...ad, status: ad.status.toLowerCase() })) };
  });

  for (const [path, status, action] of [
    ['approve', AdStatus.ACTIVE, 'admin.ad.approved'],
    ['reject', AdStatus.REJECTED, 'admin.ad.rejected'],
    ['hide', AdStatus.PAUSED, 'admin.ad.hidden'],
    ['restore', AdStatus.MODERATION, 'admin.ad.restored'],
  ] as const) {
    app.post(`/admin/ads/:id/${path}`, staffOptions, async (request, reply) => {
      const actor = requireAccount(request);
      const params = parseBody(idParams, request.params, reply);
      const body = parseBody(noteBody, request.body, reply);
      if (!params || !body) return;
      const existing = await prisma.ad.findUnique({
        where: { id: params.id },
        select: { id: true },
      });
      if (!existing) return sendError(reply, 404, 'AD_NOT_FOUND', 'Объявление не найдено.');
      const ad = await prisma.$transaction(async (tx) => {
        const updated = await tx.ad.update({
          where: { id: params.id },
          data: {
            status,
            moderationNote: body.note,
            ...(status === AdStatus.ACTIVE ? { publishedAt: new Date() } : {}),
          },
          select: { id: true, title: true, status: true, moderationNote: true },
        });
        await tx.auditLog.create({
          data: audit(actor.id, action, 'ad', params.id, { note: body.note }),
        });
        return updated;
      });
      return { ad: { ...ad, status: ad.status.toLowerCase() } };
    });
  }

  app.get('/admin/reports', staffOptions, async (request, reply) => {
    const query = parseBody(
      listQuery.extend({
        status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']).optional(),
      }),
      request.query,
      reply,
    );
    if (!query) return;
    const reports = await prisma.report.findMany({
      where: query.status ? { status: query.status.toUpperCase() as ReportStatus } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      take: query.limit,
      include: {
        reporter: { select: { email: true } },
        ad: { select: { id: true, title: true, status: true } },
        reportedUser: { select: { id: true, email: true } },
        offer: { select: { id: true, description: true } },
      },
    });
    return {
      items: reports.map((report) => ({
        ...report,
        status: report.status.toLowerCase(),
        targetType: report.targetType.toLowerCase(),
      })),
    };
  });

  app.post('/admin/reports/:id/review', staffOptions, async (request, reply) => {
    const actor = requireAccount(request);
    const params = parseBody(idParams, request.params, reply);
    const body = parseBody(reportBody, request.body, reply);
    if (!params || !body) return;
    const existing = await prisma.report.findUnique({
      where: { id: params.id },
      select: { id: true, adId: true },
    });
    if (!existing) return sendError(reply, 404, 'REPORT_NOT_FOUND', 'Жалоба не найдена.');
    const status = body.status.toUpperCase() as ReportStatus;
    const report = await prisma.$transaction(async (tx) => {
      if (body.hideAd && existing.adId) {
        await tx.ad.update({
          where: { id: existing.adId },
          data: { status: AdStatus.PAUSED, moderationNote: body.note },
        });
        await tx.auditLog.create({
          data: audit(actor.id, 'admin.ad.hidden_from_report', 'ad', existing.adId, {
            reportId: params.id,
          }),
        });
      }
      const updated = await tx.report.update({
        where: { id: params.id },
        data: {
          status,
          resolutionNote: body.note,
          resolvedById: actor.id,
          resolvedAt: status === ReportStatus.REVIEWING ? null : new Date(),
        },
      });
      await tx.auditLog.create({
        data: audit(actor.id, 'admin.report.reviewed', 'report', params.id, {
          status: body.status,
          hideAd: body.hideAd,
        }),
      });
      return updated;
    });
    return { report: { ...report, status: report.status.toLowerCase() } };
  });

  app.get('/admin/users', staffOptions, async (request, reply) => {
    const query = parseBody(listQuery, request.query, reply);
    if (!query) return;
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        profile: { select: { nickname: true } },
      },
    });
    return {
      items: users.map((user) => ({
        ...user,
        role: user.role.toLowerCase(),
        status: user.status.toLowerCase(),
      })),
    };
  });

  for (const [path, status, action] of [
    ['suspend', UserStatus.SUSPENDED, 'admin.user.suspended'],
    ['restore', UserStatus.ACTIVE, 'admin.user.restored'],
  ] as const) {
    app.post(`/admin/users/:id/${path}`, staffOptions, async (request, reply) => {
      const actor = requireAccount(request);
      if (!requireAdmin(reply, actor.role)) return;
      const params = parseBody(idParams, request.params, reply);
      const body = parseBody(noteBody, request.body, reply);
      if (!params || !body) return;
      if (params.id === actor.id)
        return sendError(
          reply,
          409,
          'SELF_ADMIN_ACTION',
          'Нельзя изменить статус собственного аккаунта.',
        );
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.user.updateMany({
          where: { id: params.id, status: { not: UserStatus.DELETED } },
          data: { status, authVersion: { increment: 1 } },
        });
        if (!updated.count) return null;
        await tx.session.updateMany({
          where: { userId: params.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.auditLog.create({
          data: audit(actor.id, action, 'user', params.id, { note: body.note }),
        });
        return tx.user.findUnique({
          where: { id: params.id },
          select: { id: true, email: true, status: true },
        });
      });
      if (!result) return sendError(reply, 404, 'USER_NOT_FOUND', 'Пользователь не найден.');
      return { user: { ...result, status: result.status.toLowerCase() } };
    });
  }

  app.get('/admin/categories', staffOptions, async () => ({
    items: await prisma.category.findMany({ orderBy: [{ position: 'asc' }, { nameRu: 'asc' }] }),
  }));
  app.post('/admin/categories', staffOptions, async (request, reply) => {
    const actor = requireAccount(request);
    if (!requireAdmin(reply, actor.role)) return;
    const body = parseBody(categoryBody, request.body, reply);
    if (!body) return;
    const category = await prisma.$transaction(async (tx) => {
      const created = await tx.category.create({ data: body });
      await tx.auditLog.create({
        data: audit(actor.id, 'admin.category.created', 'category', created.id),
      });
      return created;
    });
    return reply.code(201).send({ category });
  });
  app.patch('/admin/categories/:id', staffOptions, async (request, reply) => {
    const actor = requireAccount(request);
    if (!requireAdmin(reply, actor.role)) return;
    const params = parseBody(idParams, request.params, reply);
    const body = parseBody(categoryPatch, request.body, reply);
    if (!params || !body) return;
    const category = await prisma.$transaction(async (tx) => {
      const updated = await tx.category.update({ where: { id: params.id }, data: body });
      await tx.auditLog.create({
        data: audit(actor.id, 'admin.category.updated', 'category', params.id, body),
      });
      return updated;
    });
    return { category };
  });

  app.get('/admin/moderation-terms', staffOptions, async () => ({
    items: await prisma.moderationTerm.findMany({ orderBy: { createdAt: 'desc' } }),
  }));
  app.post('/admin/moderation-terms', staffOptions, async (request, reply) => {
    const actor = requireAccount(request);
    const body = parseBody(termBody, request.body, reply);
    if (!body) return;
    const normalizedTerm = normalizeModerationText(body.term);
    const term = await prisma.$transaction(async (tx) => {
      const created = await tx.moderationTerm.create({
        data: {
          term: body.term,
          normalizedTerm,
          severity: body.severity.toUpperCase() as ModerationSeverity,
          createdById: actor.id,
        },
      });
      await tx.auditLog.create({
        data: audit(actor.id, 'admin.moderation_term.created', 'moderation_term', created.id, {
          severity: body.severity,
        }),
      });
      return created;
    });
    return reply.code(201).send({ term: { ...term, severity: term.severity.toLowerCase() } });
  });
  app.patch('/admin/moderation-terms/:id', staffOptions, async (request, reply) => {
    const actor = requireAccount(request);
    const params = parseBody(idParams, request.params, reply);
    const body = parseBody(termPatch, request.body, reply);
    if (!params || !body) return;
    const data = {
      ...(body.term ? { term: body.term, normalizedTerm: normalizeModerationText(body.term) } : {}),
      ...(body.severity ? { severity: body.severity.toUpperCase() as ModerationSeverity } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    };
    const term = await prisma.$transaction(async (tx) => {
      const updated = await tx.moderationTerm.update({ where: { id: params.id }, data });
      await tx.auditLog.create({
        data: audit(actor.id, 'admin.moderation_term.updated', 'moderation_term', params.id, body),
      });
      return updated;
    });
    return { term: { ...term, severity: term.severity.toLowerCase() } };
  });
}
