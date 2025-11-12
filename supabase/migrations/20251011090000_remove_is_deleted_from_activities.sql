-- Migration: remove redundant isDeleted flag in favour of deletedAt timestamp

-- Step 1: ensure historical soft deletes retain a timestamp
UPDATE public.activities
SET "deletedAt" = COALESCE("deletedAt", NOW())
WHERE "isDeleted" = true;

-- Step 2: drop legacy index referencing isDeleted
DROP INDEX IF EXISTS "public"."activities_isDeleted_createdAt_idx";

-- Step 3: drop the redundant column
ALTER TABLE public.activities
  DROP COLUMN IF EXISTS "isDeleted";

-- Step 4: add replacement index to accelerate deletedAt filters
CREATE INDEX IF NOT EXISTS "activities_deletedAt_createdAt_idx"
  ON public.activities ("deletedAt", "createdAt" DESC);
