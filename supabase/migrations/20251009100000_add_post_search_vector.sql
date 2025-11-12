-- Phase 11 / M1 / T1.1: 为 Post 模型添加全文搜索支持，为 User 模型添加模糊搜索索引

-- 启用 pg_trgm 扩展（用于模糊搜索）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 为 Post 表添加 search_vector 列
-- 使用 setweight 为不同字段设置权重：
-- A (最高): title - 标题最重要
-- B (高): excerpt, seoDescription - 摘要和 SEO 描述次之
-- C (中): content - 正文内容权重较低
ALTER TABLE posts
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("seoDescription", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(content, '')), 'C')
  ) STORED;

-- 为 Post 的 search_vector 创建 GIN 索引
CREATE INDEX idx_posts_search_vector
  ON posts USING GIN (search_vector);

-- 为 User 表的 name 字段创建 pg_trgm 索引（用于模糊搜索用户名）
CREATE INDEX idx_users_name_trgm
  ON users USING GIN (name gin_trgm_ops);

-- 为 User 表的 bio 字段创建 pg_trgm 索引（用于模糊搜索用户简介）
CREATE INDEX idx_users_bio_trgm
  ON users USING GIN (bio gin_trgm_ops);

