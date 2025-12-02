-- Migration: Enforce exactly one notification target (post/activity/follower)
-- Date: 2025-12-02 11:30:00

-- 1) Add followerId to support user-target notifications (e.g., follow/system)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS "followerId" text;

ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS notifications_followerId_fkey;

ALTER TABLE public.notifications
ADD CONSTRAINT notifications_followerId_fkey
FOREIGN KEY ("followerId") REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_followerId
  ON public.notifications("followerId");

-- 2) Remove legacy "<=1" target constraint
ALTER TABLE public.notifications
DROP CONSTRAINT IF EXISTS chk_notifications_target_exclusive;

-- 3) Backfill rows that previously had no target so the new CHECK can validate
UPDATE public.notifications
SET "followerId" = CASE
  WHEN type = 'FOLLOW' THEN "actorId"
  WHEN type = 'SYSTEM' THEN "recipientId"
  ELSE "followerId"
END
WHERE "postId" IS NULL
  AND "activityId" IS NULL
  AND "followerId" IS NULL;

-- 4) Guardrail: fail fast if any row still lacks exactly one target
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE num_nonnulls(n."postId", n."activityId", n."followerId") <> 1
  ) THEN
    RAISE EXCEPTION 'notifications must have exactly one target (postId, activityId, followerId)';
  END IF;
END $$;

-- 5) Enforce "exactly one target" constraint
ALTER TABLE public.notifications
ADD CONSTRAINT chk_notifications_target_exactly_one
CHECK (num_nonnulls("postId", "activityId", "followerId") = 1);

-- ============================================================================
-- DOWN MIGRATION (手工执行)
-- ============================================================================
-- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notifications_target_exactly_one;
-- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_followerId_fkey;
-- ALTER TABLE public.notifications DROP COLUMN IF EXISTS "followerId";
-- ALTER TABLE public.notifications ADD CONSTRAINT chk_notifications_target_exclusive
--   CHECK (num_nonnulls("postId", "commentId", "activityId") <= 1);
