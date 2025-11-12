-- 添加 Post 模型的性能优化索引
-- 这些索引用于优化常见的查询模式

-- 按创建时间倒序排序（最常用的排序方式）
CREATE INDEX IF NOT EXISTS "posts_createdAt_idx" ON "public"."posts" ("createdAt" DESC);

-- 按浏览量倒序排序（热门文章）
CREATE INDEX IF NOT EXISTS "posts_viewCount_idx" ON "public"."posts" ("viewCount" DESC);

-- 筛选置顶文章
CREATE INDEX IF NOT EXISTS "posts_isPinned_idx" ON "public"."posts" ("isPinned");

-- 复合索引：已发布文章按创建时间倒序（最常见的查询模式）
CREATE INDEX IF NOT EXISTS "posts_published_createdAt_idx" ON "public"."posts" ("published", "createdAt" DESC);
