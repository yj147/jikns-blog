-- Phase 11 / Hotfix: ensure activities search_vector matches application expectations
-- Recompute and enforce generated column, then add the missing GIN index

-- 1) Backfill existing values so historical rows participate in search immediately
UPDATE "public"."activities"
SET "search_vector" = setweight(to_tsvector('simple', coalesce("content", '')), 'A');

-- 2) Drop the column and recreate it as a generated column
ALTER TABLE "public"."activities"
  DROP COLUMN "search_vector";

ALTER TABLE "public"."activities"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("content", '')), 'A')
  ) STORED;

-- 3) Add the missing GIN index used by searchActivities
CREATE INDEX IF NOT EXISTS "activities_search_vector_idx"
  ON "public"."activities" USING GIN ("search_vector");
