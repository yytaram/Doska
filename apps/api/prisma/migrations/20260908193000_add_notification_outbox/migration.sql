CREATE TYPE "NotificationType" AS ENUM ('NEW_OFFER', 'NEW_MESSAGE', 'MODERATION_RESULT', 'AD_EXPIRING');
CREATE TYPE "NotificationJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "notification_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient_id" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "status" "NotificationJobStatus" NOT NULL DEFAULT 'PENDING',
  "dedupe_key" VARCHAR(200) NOT NULL,
  "data" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3) DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMPTZ(3),
  "sent_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_jobs_dedupe_key_key" ON "notification_jobs"("dedupe_key");
CREATE INDEX "notification_jobs_status_next_attempt_at_created_at_idx" ON "notification_jobs"("status", "next_attempt_at", "created_at");
CREATE INDEX "notification_jobs_recipient_id_created_at_idx" ON "notification_jobs"("recipient_id", "created_at");

ALTER TABLE "notification_jobs"
ADD CONSTRAINT "notification_jobs_recipient_id_fkey"
FOREIGN KEY ("recipient_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
