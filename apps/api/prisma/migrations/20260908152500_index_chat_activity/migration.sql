DROP INDEX "chats_last_message_at_id_idx";
CREATE INDEX "chats_updated_at_id_idx" ON "chats"("updated_at", "id");
