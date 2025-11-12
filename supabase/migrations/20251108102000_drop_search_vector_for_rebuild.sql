-- 临时删除 search_vector 列以便使用 english 配置重建
-- 这是因为本地 Supabase 实例缺少 zhparser 扩展

DROP INDEX IF EXISTS idx_posts_search_vector;
DROP INDEX IF EXISTS posts_search_vector_idx;
DROP INDEX IF EXISTS activities_search_vector_idx;

ALTER TABLE posts DROP COLUMN IF EXISTS search_vector;
ALTER TABLE activities DROP COLUMN IF EXISTS search_vector;

