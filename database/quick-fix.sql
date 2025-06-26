-- 快速修复脚本
-- 如果您遇到 "column user_id does not exist" 错误，请运行此脚本

-- 1. 删除可能存在的有问题的表（如果存在）
DROP TABLE IF EXISTS public.comments CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. 重新创建用户表
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username VARCHAR(50) UNIQUE,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    website VARCHAR(500),
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 重新创建评论表（正确的顺序）
CREATE TABLE public.comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_slug VARCHAR(255) NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    author_website VARCHAR(500),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    avatar_url VARCHAR(500),
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    is_anonymous BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 约束：匿名评论必须有作者信息，登录用户评论必须有 user_id
    CONSTRAINT check_comment_author CHECK (
        (is_anonymous = TRUE AND author_name IS NOT NULL AND author_email IS NOT NULL) OR
        (is_anonymous = FALSE AND user_id IS NOT NULL)
    )
);

-- 5. 创建基本索引
CREATE INDEX idx_comments_post_slug ON public.comments(post_slug);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comments_approved ON public.comments(is_approved);

-- 6. 启用 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 7. 创建基本 RLS 策略
CREATE POLICY "Anyone can view approved comments" ON public.comments
    FOR SELECT USING (is_approved = TRUE);

CREATE POLICY "Anyone can insert comments" ON public.comments
    FOR INSERT WITH CHECK (TRUE);

-- 8. 授予权限
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.comments TO anon, authenticated;

-- 9. 插入测试数据
INSERT INTO public.comments (
    post_slug, 
    author_name, 
    author_email, 
    content, 
    is_anonymous, 
    is_approved
) VALUES (
    'test-post',
    '测试用户',
    'test@example.com',
    '这是一条测试评论，验证数据库配置是否正确。',
    TRUE,
    TRUE
);

-- 完成
SELECT '✅ 快速修复完成！数据库已准备就绪。' as status;
