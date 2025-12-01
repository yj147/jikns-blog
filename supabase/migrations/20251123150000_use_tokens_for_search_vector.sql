-- 修复中文搜索：使用 nodejieba 分词后的 *Tokens 字段构建 search_vector
-- 方案：将 search_vector 从原始字段改为基于 Tokens 字段，使用 simple 配置

-- 1) posts.search_vector：使用已分词的 Tokens 字段
DROP INDEX IF EXISTS posts_search_vector_idx;
DROP INDEX IF EXISTS idx_posts_search_vector;
ALTER TABLE public.posts DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.posts
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("titleTokens", '')), 'A')
    || setweight(to_tsvector('simple', coalesce("excerptTokens", '')), 'B')
    || setweight(to_tsvector('simple', coalesce("seoDescriptionTokens", '')), 'B')
    || setweight(to_tsvector('simple', coalesce("contentTokens", '')), 'C')
  ) STORED;
CREATE INDEX posts_search_vector_idx
  ON public.posts USING GIN (search_vector);

-- 2) activities.search_vector：使用已分词的 contentTokens
DROP INDEX IF EXISTS activities_search_vector_idx;
ALTER TABLE public.activities DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.activities
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("contentTokens", '')), 'A')
  ) STORED;
CREATE INDEX activities_search_vector_idx
  ON public.activities USING GIN (search_vector);

-- 3) 刷新统计信息
ANALYZE public.posts;
ANALYZE public.activities;
