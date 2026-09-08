ALTER TABLE "ads"
ADD COLUMN "moderation_matches" JSONB,
ADD COLUMN "moderation_note" VARCHAR(2000);

ALTER TABLE "moderation_terms"
ADD COLUMN "created_by_id" UUID;

CREATE INDEX "moderation_terms_created_by_id_idx"
ON "moderation_terms"("created_by_id");

ALTER TABLE "moderation_terms"
ADD CONSTRAINT "moderation_terms_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
