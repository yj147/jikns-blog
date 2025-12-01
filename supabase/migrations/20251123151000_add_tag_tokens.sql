-- 为 Tag 添加 Tokens 字段以支持中文分词

-- 1) 添加 nameTokens 和 descriptionTokens 列
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS "nameTokens" TEXT;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS "descriptionTokens" TEXT;

-- 2) 重建 search_vector 使用 Tokens 字段
DROP INDEX IF EXISTS tags_search_vector_idx;
ALTER TABLE public.tags DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.tags
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("nameTokens", '')), 'A')
    || setweight(to_tsvector('simple', coalesce("descriptionTokens", '')), 'B')
  ) STORED;
CREATE INDEX tags_search_vector_idx
  ON public.tags USING GIN (search_vector);

-- 3) 刷新统计信息
ANALYZE public.tags;
