-- 添加 trending 排序索引
-- 用于优化 ORDER BY likesCount DESC, createdAt DESC, id DESC 查询
-- 使用 CONCURRENTLY 避免锁表，适合生产环境在线添加

CREATE INDEX CONCURRENTLY IF NOT EXISTS "activities_trending_idx"
  ON "activities" ("likesCount" DESC, "createdAt" DESC, "id" DESC)
  WHERE "deletedAt" IS NULL;