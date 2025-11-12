-- Phase 11 / Hardening: add application-level token columns for search

-- 1) Add token columns to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS "titleTokens" text,
  ADD COLUMN IF NOT EXISTS "excerptTokens" text,
  ADD COLUMN IF NOT EXISTS "seoDescriptionTokens" text,
  ADD COLUMN IF NOT EXISTS "contentTokens" text;

-- 2) Add token column to activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS "contentTokens" text;

-- 3) Backfill token columns with existing text to avoid empty search vectors
UPDATE public.posts
SET
  "titleTokens" = COALESCE(title, ''),
  "excerptTokens" = COALESCE(excerpt, ''),
  "seoDescriptionTokens" = COALESCE("seoDescription", ''),
  "contentTokens" = COALESCE(content, '')
WHERE
  "titleTokens" IS NULL
  OR "excerptTokens" IS NULL
  OR "seoDescriptionTokens" IS NULL
  OR "contentTokens" IS NULL;

UPDATE public.activities
SET "contentTokens" = COALESCE(content, '')
WHERE "contentTokens" IS NULL;

-- 4) Rebuild posts.search_vector to reference token columns
DROP INDEX IF EXISTS idx_posts_search_vector;
DROP INDEX IF EXISTS posts_search_vector_idx;

ALTER TABLE public.posts
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE public.posts
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("titleTokens", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("excerptTokens", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("seoDescriptionTokens", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("contentTokens", '')), 'C')
  ) STORED;

CREATE INDEX idx_posts_search_vector
  ON public.posts USING GIN (search_vector);

CREATE INDEX posts_search_vector_idx
  ON public.posts USING GIN (search_vector);

-- 5) Rebuild activities.search_vector to reference contentTokens
DROP INDEX IF EXISTS activities_search_vector_idx;

ALTER TABLE public.activities
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE public.activities
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("contentTokens", '')), 'A')
  ) STORED;

CREATE INDEX activities_search_vector_idx
  ON public.activities USING GIN (search_vector);

-- 6) Refresh statistics
ANALYZE public.posts;
ANALYZE public.activities;
