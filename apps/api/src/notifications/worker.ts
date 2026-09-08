import type { PrismaClient } from '@prisma/client';
import type { FastifyBaseLogger } from 'fastify';

import type { NotificationSender } from './service.js';
import { enqueueExpiringAdNotifications, processNotificationJobs } from './service.js';

export function createNotificationWorker(
  prisma: PrismaClient,
  sender: NotificationSender,
  logger: FastifyBaseLogger,
  intervalMilliseconds = 15_000,
) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let running = false;
  let lastExpiryScan = 0;

  async function runOnce() {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      if (now.getTime() - lastExpiryScan >= 60 * 60 * 1000) {
        const queued = await enqueueExpiringAdNotifications(prisma, now);
        logger.info({ event: 'notifications.expiry_scan', queued }, 'Expiry scan completed');
        lastExpiryScan = now.getTime();
      }
      const result = await processNotificationJobs(prisma, sender, { now });
      if (result.claimed > 0) {
        logger.info({ event: 'notifications.processed', ...result }, 'Notification jobs processed');
      }
    } catch (error) {
      logger.error({ event: 'notifications.worker_failed', error }, 'Notification worker failed');
    } finally {
      running = false;
    }
  }

  return {
    runOnce,
    start() {
      void runOnce();
      timer = setInterval(() => void runOnce(), intervalMilliseconds);
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}
