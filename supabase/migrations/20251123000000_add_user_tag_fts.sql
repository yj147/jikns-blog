-- 为统一搜索功能添加 User 和 Tag 表的全文检索支持

-- 1) 为 users 表添加 search_vector
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(email, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS users_search_vector_idx
  ON public.users USING GIN (search_vector);

-- 2) 为 tags 表添加 search_vector
ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS tags_search_vector_idx
  ON public.tags USING GIN (search_vector);
