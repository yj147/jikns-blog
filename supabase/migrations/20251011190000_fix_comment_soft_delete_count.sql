-- Migration: Fix Comment Soft Delete Count Issue
-- Purpose: Add deletedAt field and update trigger to handle soft delete
-- Date: 2025-10-11
-- Priority: P0 - Critical data consistency fix

-- ============================================================================
-- Part 1: Add deletedAt Column to Comments Table
-- ============================================================================

-- 添加 deletedAt 列
ALTER TABLE comments ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;

-- 创建索引以提升软删除查询性能
CREATE INDEX IF NOT EXISTS "comments_deletedAt_idx" ON comments("deletedAt");

-- ============================================================================
-- Part 2: Migrate Existing Soft-Deleted Comments
-- ============================================================================

-- 将现有的软删除评论（content = "[该评论已删除]"）迁移到使用 deletedAt
UPDATE comments
SET "deletedAt" = "updatedAt"
WHERE content = '[该评论已删除]' AND "deletedAt" IS NULL;

-- ============================================================================
-- Part 3: Update Comments Count Trigger to Handle Soft Delete
-- ============================================================================

-- 删除旧触发器
DROP TRIGGER IF EXISTS sync_activity_comments_count_trigger ON comments;

-- 重新创建触发器函数，支持 UPDATE 操作（软删除）
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

  -- DELETE: 硬删除评论时，减少计数
  IF TG_OP = 'DELETE' AND OLD."activityId" IS NOT NULL THEN
    UPDATE activities
    SET "commentsCount" = GREATEST("commentsCount" - 1, 0)
    WHERE id = OLD."activityId";
    RETURN OLD;
  END IF;

  -- UPDATE: 检查 deletedAt 变化（软删除/恢复）
  IF TG_OP = 'UPDATE' AND NEW."activityId" IS NOT NULL THEN
    -- 从未删除变为已删除：减少计数
    IF OLD."deletedAt" IS NULL AND NEW."deletedAt" IS NOT NULL THEN
      UPDATE activities
      SET "commentsCount" = GREATEST("commentsCount" - 1, 0)
      WHERE id = NEW."activityId";
    END IF;

    -- 从已删除恢复为未删除：增加计数
    IF OLD."deletedAt" IS NOT NULL AND NEW."deletedAt" IS NULL THEN
      UPDATE activities
      SET "commentsCount" = "commentsCount" + 1
      WHERE id = NEW."activityId";
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 重新创建触发器，监听 INSERT, UPDATE, DELETE
CREATE TRIGGER sync_activity_comments_count_trigger
AFTER INSERT OR UPDATE OR DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION sync_activity_comments_count();

-- ============================================================================
-- Part 4: Re-sync Comment Counts (Exclude Soft-Deleted Comments)
-- ============================================================================

-- 重新同步评论计数，排除软删除的评论
UPDATE activities a
SET "commentsCount" = COALESCE((
  SELECT COUNT(*)
  FROM comments c
  WHERE c."activityId" = a.id
    AND c."deletedAt" IS NULL  -- 排除软删除的评论
), 0);

-- ============================================================================
-- Part 5: Update Verification Function
-- ============================================================================

-- 更新验证函数，排除软删除的评论
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
    (SELECT COUNT(*) FROM likes l WHERE l."activityId" = a.id) as expected_likes,
    a."likesCount" as actual_likes,
    (SELECT COUNT(*) FROM comments c WHERE c."activityId" = a.id AND c."deletedAt" IS NULL) as expected_comments,
    a."commentsCount" as actual_comments
  FROM activities a
  WHERE
    (SELECT COUNT(*) FROM likes l WHERE l."activityId" = a.id) != a."likesCount" OR
    (SELECT COUNT(*) FROM comments c WHERE c."activityId" = a.id AND c."deletedAt" IS NULL) != a."commentsCount";
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- 验证触发器已更新
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sync_activity_comments_count_trigger'
  ) THEN
    RAISE EXCEPTION 'Trigger sync_activity_comments_count_trigger was not created';
  END IF;

  RAISE NOTICE 'Comment soft delete count fix applied successfully';
END $$;

