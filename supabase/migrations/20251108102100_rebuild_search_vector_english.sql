-- 使用 english 配置重建 search_vector 列和索引
-- 这是临时方案，生产环境应使用 zhparser (public.zhsearch)

-- 1) 重建 posts.search_vector
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce("seoDescription", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_posts_search_vector
  ON public.posts USING GIN (search_vector);

CREATE INDEX IF NOT EXISTS posts_search_vector_idx
  ON public.posts USING GIN (search_vector);

-- 2) 重建 activities.search_vector
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(content, '')), 'A')
  ) STORED;

CREATE INDEX IF NOT EXISTS activities_search_vector_idx
  ON public.activities USING GIN (search_vector);

-- 3) 触发统计信息刷新
ANALYZE public.posts;
ANALYZE public.activities;

