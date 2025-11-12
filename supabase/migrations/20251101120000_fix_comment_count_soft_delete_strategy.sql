-- Migration: Fix Comment Count Soft Delete Strategy
-- Purpose: Align trigger logic with "soft delete visible" strategy
-- Date: 2025-11-01
-- Priority: P1 - Critical data consistency fix
--
-- Design Decision:
-- Soft-deleted comments should be VISIBLE to users (as placeholders).
-- Therefore, commentsCount should INCLUDE soft-deleted comments.
-- Trigger should only update count on INSERT/DELETE, not on UPDATE (soft delete).

-- ============================================================================
-- Part 1: Drop Existing Trigger
-- ============================================================================

DROP TRIGGER IF EXISTS sync_activity_comments_count_trigger ON comments;

-- ============================================================================
-- Part 2: Recreate Trigger Function (Remove UPDATE Handling)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_activity_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  -- INSERT: 插入新评论时，增加计数
  IF TG_OP = 'INSERT' AND NEW."activityId" IS NOT NULL THEN
    UPDATE activities
    SET "commentsCount" = "commentsCount" + 1
    WHERE id = NEW."activityId";
    RETURN NEW;
  END IF;

  -- DELETE: 硬删除评论时，减少计数（防止负数）
  IF TG_OP = 'DELETE' AND OLD."activityId" IS NOT NULL THEN
    UPDATE activities
    SET "commentsCount" = GREATEST("commentsCount" - 1, 0)
    WHERE id = OLD."activityId";
    RETURN OLD;
  END IF;

  -- 注意：不再处理 UPDATE 操作
  -- 软删除（UPDATE deletedAt）不应该改变计数，因为软删除的评论仍然可见（占位符）

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Part 3: Recreate Trigger (Only INSERT and DELETE)
-- ============================================================================

CREATE TRIGGER sync_activity_comments_count_trigger
AFTER INSERT OR DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION sync_activity_comments_count();

-- ============================================================================
-- Part 4: Re-sync Comment Counts (Include Soft-Deleted Comments)
-- ============================================================================

-- 重新同步评论计数，包含软删除的评论
UPDATE activities a
SET "commentsCount" = COALESCE((
  SELECT COUNT(*)
  FROM comments c
  WHERE c."activityId" = a.id
  -- 不过滤 deletedAt：计数包含软删除评论
), 0);

-- ============================================================================
-- Part 5: Update Verification Function
-- ============================================================================

-- 更新验证函数：不再排除软删除评论
CREATE OR REPLACE FUNCTION verify_activity_counts()
RETURNS TABLE(
  activity_id TEXT,
  expected_likes BIGINT,
  actual_likes INT,
  expected_comments BIGINT,
  actual_comments INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    COUNT(DISTINCT l.id) as expected_likes,
    a."likesCount" as actual_likes,
    COUNT(DISTINCT c.id) as expected_comments,
    a."commentsCount" as actual_comments
  FROM activities a
  LEFT JOIN likes l ON l."activityId" = a.id
  LEFT JOIN comments c ON c."activityId" = a.id
  -- 不过滤 c."deletedAt"：包含软删除评论
  GROUP BY a.id, a."likesCount", a."commentsCount"
  HAVING
    COUNT(DISTINCT l.id) != a."likesCount" OR
    COUNT(DISTINCT c.id) != a."commentsCount";
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Verification and Summary
-- ============================================================================

DO $$
DECLARE
  total_activities INT;
  total_comments INT;
  soft_deleted_comments INT;
BEGIN
  SELECT COUNT(*) INTO total_activities FROM activities;
  SELECT COUNT(*) INTO total_comments FROM comments;
  SELECT COUNT(*) INTO soft_deleted_comments FROM comments WHERE "deletedAt" IS NOT NULL;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20251101120000 completed';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Changes:';
  RAISE NOTICE '  1. Removed UPDATE handling from trigger';
  RAISE NOTICE '  2. Soft delete (UPDATE deletedAt) no longer affects commentsCount';
  RAISE NOTICE '  3. Re-synced all comment counts (including soft-deleted)';
  RAISE NOTICE '  4. Updated verification function';
  RAISE NOTICE '';
  RAISE NOTICE 'Statistics:';
  RAISE NOTICE '  - Total activities: %', total_activities;
  RAISE NOTICE '  - Total comments: %', total_comments;
  RAISE NOTICE '  - Soft-deleted comments: %', soft_deleted_comments;
  RAISE NOTICE '';
  RAISE NOTICE 'Design Decision:';
  RAISE NOTICE '  Soft-deleted comments are VISIBLE (as placeholders)';
  RAISE NOTICE '  Therefore, commentsCount INCLUDES soft-deleted comments';
  RAISE NOTICE '';
  RAISE NOTICE 'Impact:';
  RAISE NOTICE '  - Users see comment count matching actual visible comments';
  RAISE NOTICE '  - Soft delete operation does not change count';
  RAISE NOTICE '  - Hard delete (DELETE) still decreases count';
  RAISE NOTICE '';
  RAISE NOTICE 'Rollback:';
  RAISE NOTICE '  -- Restore old trigger from migration 20251011190000';
  RAISE NOTICE '  -- Re-sync counts excluding soft-deleted comments';
  RAISE NOTICE '========================================';
END $$;

