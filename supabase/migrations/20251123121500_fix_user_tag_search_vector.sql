-- 修复用户与标签全文检索：拆分邮箱、兼容中英文
-- 方案：重新定义 search_vector 为 simple 配置，并对邮箱做字符归一化

-- 1) users.search_vector
DROP INDEX IF EXISTS users_search_vector_idx;
ALTER TABLE public.users DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.users
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A')
    || setweight(
      to_tsvector(
        'simple',
        regexp_replace(coalesce(email, ''), '[^a-zA-Z0-9]+', ' ', 'g')
      ),
      'B'
    )
    || setweight(to_tsvector('simple', coalesce(bio, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS users_search_vector_idx
  ON public.users USING GIN (search_vector);

-- 2) tags.search_vector
DROP INDEX IF EXISTS tags_search_vector_idx;
ALTER TABLE public.tags DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.tags
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS tags_search_vector_idx
  ON public.tags USING GIN (search_vector);
