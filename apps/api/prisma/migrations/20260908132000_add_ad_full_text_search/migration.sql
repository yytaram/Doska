CREATE INDEX "ads_full_text_search_idx"
ON "ads"
USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')));
