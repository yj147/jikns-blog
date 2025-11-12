-- 添加复合索引和全文检索索引
-- 这些索引用于优化排序和搜索性能

-- 复合索引：按创建时间和 ID 倒序排序（用于分页稳定性）
-- 当 createdAt 相同时，使用 id 作为第二排序键，确保排序稳定
CREATE INDEX IF NOT EXISTS "posts_createdAt_id_idx" ON "public"."posts" ("createdAt" DESC, "id" DESC);

-- GIN 索引：全文检索（用于高效搜索）
-- 使用 PostgreSQL 的 tsvector 类型进行全文检索
CREATE INDEX IF NOT EXISTS "posts_search_vector_idx" ON "public"."posts" USING GIN ("search_vector");

