-- 为 User 添加 Tokens 字段以支持中文分词

-- 1) 添加 nameTokens 和 bioTokens 列
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "nameTokens" TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "bioTokens" TEXT;

-- 2) 重建 search_vector 使用 Tokens 字段
DROP INDEX IF EXISTS users_search_vector_idx;
ALTER TABLE public.users DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.users
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("nameTokens", '')), 'A')
    || setweight(
      to_tsvector(
        'simple',
        regexp_replace(coalesce(email, ''), '[^a-zA-Z0-9]+', ' ', 'g')
      ),
      'B'
    )
    || setweight(to_tsvector('simple', coalesce("bioTokens", '')), 'C')
  ) STORED;
CREATE INDEX users_search_vector_idx
  ON public.users USING GIN (search_vector);

-- 3) 刷新统计信息
ANALYZE public.users;
