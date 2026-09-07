-- DropIndex
DROP INDEX "ads_category_id_city_id_status_created_at_idx";

-- DropIndex
DROP INDEX "ads_owner_id_status_created_at_idx";

-- DropIndex
DROP INDEX "ads_status_created_at_idx";

-- CreateIndex
CREATE INDEX "ads_owner_id_created_at_id_idx" ON "ads"("owner_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "ads_owner_id_status_created_at_id_idx" ON "ads"("owner_id", "status", "created_at", "id");

-- CreateIndex
CREATE INDEX "ads_status_created_at_id_idx" ON "ads"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "ads_category_id_city_id_status_created_at_id_idx" ON "ads"("category_id", "city_id", "status", "created_at", "id");
