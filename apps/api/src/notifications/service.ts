import { NotificationJobStatus, NotificationType, Prisma, type PrismaClient } from '@prisma/client';

const MAX_ATTEMPTS = 5;
const LEASE_MILLISECONDS = 5 * 60 * 1000;

export interface NotificationSender {
  send(messages: PushMessage[]): Promise<{ invalidTokens: string[] }>;
}

export interface PushMessage {
  body: string;
  data: Record<string, string>;
  title: string;
  token: string;
}

export function enqueueNotification(
  prisma: Prisma.TransactionClient,
  input: {
    data?: Prisma.InputJsonObject;
    dedupeKey: string;
    recipientId: string;
    type: NotificationType;
  },
) {
  return prisma.notificationJob.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {},
    create: input,
  });
}

function contentFor(job: {
  data: Prisma.JsonValue | null;
  type: NotificationType;
}): Omit<PushMessage, 'token'> {
  const data: Record<string, string> = {};
  if (job.data && typeof job.data === 'object' && !Array.isArray(job.data)) {
    for (const [key, value] of Object.entries(job.data)) {
      if (typeof value === 'string') data[key] = value;
    }
  }

  switch (job.type) {
    case NotificationType.NEW_OFFER:
      return {
        title: 'Новое предложение',
        body: 'К вашему объявлению отправили предложение.',
        data,
      };
    case NotificationType.NEW_MESSAGE:
      return { title: 'Новое сообщение', body: 'У вас новое сообщение в Doska.', data };
    case NotificationType.MODERATION_RESULT:
      return {
        title: 'Результат модерации',
        body:
          data.result === 'approved'
            ? 'Ваше объявление опубликовано.'
            : 'Статус вашего объявления изменён.',
        data,
      };
    case NotificationType.AD_EXPIRING:
      return {
        title: 'Объявление скоро истечёт',
        body: 'Проверьте актуальность объявления в Doska.',
        data,
      };
  }
}

async function claimJobs(prisma: PrismaClient, now: Date, limit: number) {
  const staleBefore = new Date(now.getTime() - LEASE_MILLISECONDS);
  return prisma.$transaction(async (transaction) => {
    const candidates = await transaction.notificationJob.findMany({
      where: {
        OR: [
          {
            status: { in: [NotificationJobStatus.PENDING, NotificationJobStatus.FAILED] },
            nextAttemptAt: { lte: now },
          },
          { status: NotificationJobStatus.PROCESSING, lockedAt: { lt: staleBefore } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    const claimed: string[] = [];
    for (const candidate of candidates) {
      const result = await transaction.notificationJob.updateMany({
        where: {
          id: candidate.id,
          OR: [
            {
              status: { in: [NotificationJobStatus.PENDING, NotificationJobStatus.FAILED] },
              nextAttemptAt: { lte: now },
            },
            { status: NotificationJobStatus.PROCESSING, lockedAt: { lt: staleBefore } },
          ],
        },
        data: {
          status: NotificationJobStatus.PROCESSING,
          lockedAt: now,
          attempts: { increment: 1 },
        },
      });
      if (result.count === 1) claimed.push(candidate.id);
    }
    return claimed;
  });
}

export async function processNotificationJobs(
  prisma: PrismaClient,
  sender: NotificationSender,
  options: { limit?: number; now?: Date } = {},
) {
  const now = options.now ?? new Date();
  const ids = await claimJobs(prisma, now, options.limit ?? 20);
  let sent = 0;
  let failed = 0;

  for (const id of ids) {
    const job = await prisma.notificationJob.findUniqueOrThrow({ where: { id } });
    const tokens = await prisma.deviceToken.findMany({
      where: { userId: job.recipientId, isEnabled: true },
      select: { token: true },
    });

    try {
      const content = contentFor(job);
      const result = await sender.send(tokens.map(({ token }) => ({ token, ...content })));
      if (result.invalidTokens.length > 0) {
        await prisma.deviceToken.updateMany({
          where: { token: { in: result.invalidTokens } },
          data: { isEnabled: false },
        });
      }
      await prisma.notificationJob.update({
        where: { id },
        data: {
          status: NotificationJobStatus.SENT,
          sentAt: new Date(),
          lockedAt: null,
          nextAttemptAt: null,
          lastError: null,
        },
      });
      sent += 1;
    } catch {
      const exhausted = job.attempts >= MAX_ATTEMPTS;
      const delayMinutes = Math.min(60, 2 ** Math.max(0, job.attempts - 1));
      await prisma.notificationJob.update({
        where: { id },
        data: {
          status: NotificationJobStatus.FAILED,
          lockedAt: null,
          nextAttemptAt: exhausted ? null : new Date(now.getTime() + delayMinutes * 60 * 1000),
          lastError: exhausted ? 'Push delivery exhausted retries.' : 'Push provider unavailable.',
        },
      });
      failed += 1;
    }
  }

  return { claimed: ids.length, failed, sent };
}

export async function enqueueExpiringAdNotifications(prisma: PrismaClient, now = new Date()) {
  const threshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const ads = await prisma.ad.findMany({
    where: { status: 'ACTIVE', expiresAt: { gt: now, lte: threshold } },
    select: { id: true, ownerId: true, expiresAt: true },
  });
  await prisma.$transaction(
    ads.map((ad) =>
      prisma.notificationJob.upsert({
        where: { dedupeKey: `ad-expiring:${ad.id}:${ad.expiresAt?.toISOString()}` },
        update: {},
        create: {
          dedupeKey: `ad-expiring:${ad.id}:${ad.expiresAt?.toISOString()}`,
          recipientId: ad.ownerId,
          type: NotificationType.AD_EXPIRING,
          data: { adId: ad.id, url: `/ads/${ad.id}` },
        },
      }),
    ),
  );
  return ads.length;
}
