-- Migration: Add PostgreSQL triggers for Activity count fields
-- Purpose: Automatically maintain likesCount and commentsCount consistency
-- Date: 2025-10-11

-- ============================================================================
-- Part 1: Likes Count Trigger
-- ============================================================================

-- 创建触发器函数：自动维护 activities.likesCount
CREATE OR REPLACE FUNCTION sync_activity_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入点赞记录时，增加计数
  IF TG_OP = 'INSERT' AND NEW."activityId" IS NOT NULL THEN
    UPDATE activities
    SET "likesCount" = "likesCount" + 1
    WHERE id = NEW."activityId";
    RETURN NEW;
  END IF;

  -- 删除点赞记录时，减少计数（防止负数）
  IF TG_OP = 'DELETE' AND OLD."activityId" IS NOT NULL THEN
    UPDATE activities
    SET "likesCount" = GREATEST("likesCount" - 1, 0)
    WHERE id = OLD."activityId";
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：在 likes 表的 INSERT/DELETE 操作后执行
CREATE TRIGGER sync_activity_likes_count_trigger
AFTER INSERT OR DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION sync_activity_likes_count();

-- ============================================================================
-- Part 2: Comments Count Trigger
-- ============================================================================

-- 创建触发器函数：自动维护 activities.commentsCount
CREATE OR REPLACE FUNCTION sync_activity_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  -- 插入评论记录时，增加计数
  IF TG_OP = 'INSERT' AND NEW."activityId" IS NOT NULL THEN
    UPDATE activities
    SET "commentsCount" = "commentsCount" + 1
    WHERE id = NEW."activityId";
    RETURN NEW;
  END IF;

  -- 删除评论记录时，减少计数（防止负数）
  IF TG_OP = 'DELETE' AND OLD."activityId" IS NOT NULL THEN
    UPDATE activities
    SET "commentsCount" = GREATEST("commentsCount" - 1, 0)
    WHERE id = OLD."activityId";
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：在 comments 表的 INSERT/DELETE 操作后执行
CREATE TRIGGER sync_activity_comments_count_trigger
AFTER INSERT OR DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION sync_activity_comments_count();

-- ============================================================================
-- Part 3: Initialize Existing Data
-- ============================================================================

-- 同步现有数据的 likesCount
UPDATE activities a
SET "likesCount" = COALESCE((
  SELECT COUNT(*)
  FROM likes l
  WHERE l."activityId" = a.id
), 0);

-- 同步现有数据的 commentsCount
UPDATE activities a
SET "commentsCount" = COALESCE((
  SELECT COUNT(*)
  FROM comments c
  WHERE c."activityId" = a.id
), 0);

-- ============================================================================
-- Part 4: Verification Function (Optional)
-- ============================================================================

-- 创建验证函数：检查计数是否一致
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
  GROUP BY a.id, a."likesCount", a."commentsCount"
  HAVING
    COUNT(DISTINCT l.id) != a."likesCount" OR
    COUNT(DISTINCT c.id) != a."commentsCount";
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- 验证触发器已创建
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'sync_activity_likes_count_trigger'
  ) THEN
    RAISE EXCEPTION 'Trigger sync_activity_likes_count_trigger was not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'sync_activity_comments_count_trigger'
  ) THEN
    RAISE EXCEPTION 'Trigger sync_activity_comments_count_trigger was not created';
  END IF;

  RAISE NOTICE 'Activity count triggers created successfully';
END $$;

