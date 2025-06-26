-- PostgreSQL 数据库初始化脚本
-- 适用于 Vercel Postgres

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建评论表
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_slug VARCHAR(255) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  author_email VARCHAR(255) NOT NULL,
  author_website VARCHAR(255),
  content TEXT NOT NULL,
  avatar_url VARCHAR(500),
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_comments_post_slug ON comments(post_slug);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_approved ON comments(is_approved);
CREATE INDEX IF NOT EXISTS idx_comments_email ON comments(author_email);

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
CREATE TRIGGER update_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 创建管理员表（可选，用于后续扩展）
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建管理员表索引
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- 创建评论统计视图
CREATE OR REPLACE VIEW comment_stats AS
SELECT
  post_slug,
  COUNT(*) as total_comments,
  COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as top_level_comments,
  COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) as replies,
  COUNT(CASE WHEN is_approved = TRUE THEN 1 END) as approved_comments,
  COUNT(CASE WHEN is_approved = FALSE THEN 1 END) as pending_comments,
  MAX(created_at) as latest_comment
FROM comments
GROUP BY post_slug;

-- 插入示例管理员账户（密码: admin123，请在生产环境中修改）
-- 注意：这里使用简单的 MD5，生产环境建议使用 bcrypt
INSERT INTO admins (username, email, password_hash)
VALUES ('admin', 'admin@example.com', MD5('admin123'))
ON CONFLICT (username) DO NOTHING;

-- 创建函数：获取评论树结构
CREATE OR REPLACE FUNCTION get_comment_tree(p_post_slug VARCHAR(255))
RETURNS TABLE (
  id UUID,
  post_slug VARCHAR(255),
  author_name VARCHAR(100),
  author_email VARCHAR(255),
  author_website VARCHAR(255),
  content TEXT,
  avatar_url VARCHAR(500),
  parent_id UUID,
  is_approved BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  level INTEGER,
  path TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE comment_tree AS (
    -- 顶级评论
    SELECT
      c.id, c.post_slug, c.author_name, c.author_email, c.author_website,
      c.content, c.avatar_url, c.parent_id, c.is_approved, c.created_at, c.updated_at,
      0 as level, c.id::TEXT as path
    FROM comments c
    WHERE c.post_slug = p_post_slug AND c.parent_id IS NULL AND c.is_approved = TRUE

    UNION ALL

    -- 子评论
    SELECT
      c.id, c.post_slug, c.author_name, c.author_email, c.author_website,
      c.content, c.avatar_url, c.parent_id, c.is_approved, c.created_at, c.updated_at,
      ct.level + 1, ct.path || '/' || c.id::TEXT
    FROM comments c
    INNER JOIN comment_tree ct ON c.parent_id = ct.id
    WHERE c.is_approved = TRUE
  )
  SELECT * FROM comment_tree
  ORDER BY path, created_at;
END;
$$ LANGUAGE plpgsql;
