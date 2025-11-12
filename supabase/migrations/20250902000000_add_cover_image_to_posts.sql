-- 添加 coverImage 字段到 posts 表
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS "coverImage" text;