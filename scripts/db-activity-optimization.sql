-- Activity 模块数据库维护脚本（Phase 6 schema 对齐版）
-- 版本: 2.0
-- 用途: 校准冗余统计数据、补充索引、确保触发器与 camelCase 字段一致
-- 执行时机: 当 likes/comments 数据需要批量修复或迁移后进行校验时运行

-- =============================================================================
-- 索引（全部使用 camelCase 列名，并对已存在场景安全幂等）
-- =============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_timeline
ON "activities" ("authorId", "createdAt" DESC)
WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_timeline
ON "activities" ("createdAt" DESC)
WHERE "deletedAt" IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_pinned
ON "activities" ("isPinned", "createdAt" DESC)
WHERE "deletedAt" IS NULL AND "isPinned" = TRUE;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_deleted_filter
ON "activities" ("deletedAt", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_stats
ON "activities" ("likesCount" DESC, "commentsCount" DESC, "viewsCount" DESC)
WHERE "deletedAt" IS NULL;

-- =============================================================================
-- 统计字段校准（覆写冗余计数，避免旧字段残留）
-- =============================================================================

UPDATE "activities" AS a
SET
  "likesCount" = COALESCE(l.like_count, 0),
  "commentsCount" = COALESCE(c.comment_count, 0)
FROM (
  SELECT "activityId" AS id, COUNT(*) AS like_count
  FROM "likes"
  WHERE "activityId" IS NOT NULL
  GROUP BY "activityId"
) AS l
FULL OUTER JOIN (
  SELECT "activityId" AS id, COUNT(*) AS comment_count
  FROM "comments"
  WHERE "activityId" IS NOT NULL
  GROUP BY "activityId"
) AS c ON l.id = c.id
WHERE a.id = COALESCE(l.id, c.id);

UPDATE "activities"
SET "likesCount" = 0
WHERE "likesCount" IS NULL;

UPDATE "activities"
SET "commentsCount" = 0
WHERE "commentsCount" IS NULL;

-- =============================================================================
-- 触发器：保持与 Supabase migration 中实现一致，使用 camelCase 字段
-- =============================================================================

CREATE OR REPLACE FUNCTION sync_activity_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW."activityId" IS NOT NULL THEN
    UPDATE "activities"
    SET "likesCount" = "likesCount" + 1
    WHERE id = NEW."activityId";
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND OLD."activityId" IS NOT NULL THEN
    UPDATE "activities"
    SET "likesCount" = GREATEST("likesCount" - 1, 0)
    WHERE id = OLD."activityId";
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sync_activity_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW."activityId" IS NOT NULL THEN
    UPDATE "activities"
    SET "commentsCount" = "commentsCount" + 1
    WHERE id = NEW."activityId";
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND OLD."activityId" IS NOT NULL THEN
    UPDATE "activities"
    SET "commentsCount" = GREATEST("commentsCount" - 1, 0)
    WHERE id = OLD."activityId";
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_activity_likes_count_trigger') THEN
    DROP TRIGGER sync_activity_likes_count_trigger ON "likes";
  END IF;

  EXECUTE 'CREATE TRIGGER sync_activity_likes_count_trigger
    AFTER INSERT OR DELETE ON "likes"
    FOR EACH ROW
    EXECUTE FUNCTION sync_activity_likes_count();';

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_activity_comments_count_trigger') THEN
    DROP TRIGGER sync_activity_comments_count_trigger ON "comments";
  END IF;

  EXECUTE 'CREATE TRIGGER sync_activity_comments_count_trigger
    AFTER INSERT OR DELETE ON "comments"
    FOR EACH ROW
    EXECUTE FUNCTION sync_activity_comments_count();';
END $$;

-- =============================================================================
-- 验证输出（可选查询）
-- =============================================================================

-- SELECT id, "likesCount", "commentsCount" FROM "activities" ORDER BY "updatedAt" DESC LIMIT 5;
