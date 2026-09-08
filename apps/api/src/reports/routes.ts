import { ReportTargetType, PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { createAuthenticate, requireAccount } from '../auth/guard.js';
import { parseBody, sendError } from '../http-errors.js';

const reportSchema = z.object({
  targetType: z.enum(['ad', 'user', 'offer']),
  targetId: z.string().uuid(),
  reason: z.string().trim().min(3).max(80),
  details: z.string().trim().max(2000).optional(),
});

const targetTypes = {
  ad: ReportTargetType.AD,
  user: ReportTargetType.USER,
  offer: ReportTargetType.OFFER,
} as const;

export function registerReportRoutes(app: FastifyInstance, prisma: PrismaClient) {
  const authenticate = createAuthenticate(prisma);

  app.post(
    '/reports',
    { onRequest: authenticate, config: { rateLimit: { max: 10, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const account = requireAccount(request);
      const body = parseBody(reportSchema, request.body, reply);
      if (!body) return;

      let targetData: { adId?: string; offerId?: string; reportedUserId?: string } | undefined;
      if (body.targetType === 'ad') {
        const ad = await prisma.ad.findUnique({
          where: { id: body.targetId },
          select: { id: true },
        });
        if (ad) targetData = { adId: ad.id };
      } else if (body.targetType === 'offer') {
        const offer = await prisma.offer.findUnique({
          where: { id: body.targetId },
          select: { id: true },
        });
        if (offer) targetData = { offerId: offer.id };
      } else if (body.targetId !== account.id) {
        const user = await prisma.user.findUnique({
          where: { id: body.targetId },
          select: { id: true },
        });
        if (user) targetData = { reportedUserId: user.id };
      }

      if (!targetData) {
        return sendError(reply, 404, 'REPORT_TARGET_NOT_FOUND', 'Объект жалобы не найден.');
      }

      const report = await prisma.report.create({
        data: {
          reporterId: account.id,
          targetType: targetTypes[body.targetType],
          ...targetData,
          reason: body.reason,
          details: body.details,
        },
        select: { id: true, status: true, createdAt: true },
      });
      return reply.code(201).send({ report: { ...report, status: report.status.toLowerCase() } });
    },
  );
}
