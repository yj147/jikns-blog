-- Supabase 数据库初始化脚本
-- 支持匿名评论和登录用户评论的混合系统

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建用户表（扩展 Supabase Auth 的用户信息）
CREATE TABLE IF NOT EXISTS public.users (
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

-- 创建评论表（支持匿名和登录用户）
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_slug VARCHAR(255) NOT NULL,

    -- 匿名用户信息（当 is_anonymous = true 时使用）
    author_name VARCHAR(100) NOT NULL,
    author_email VARCHAR(255) NOT NULL,
    author_website VARCHAR(500),

    -- 登录用户信息（当 is_anonymous = false 时使用）
    user_id UUID,

    content TEXT NOT NULL,
    avatar_url VARCHAR(500),
    parent_id UUID,

    -- 评论状态
    is_anonymous BOOLEAN DEFAULT TRUE,
    is_approved BOOLEAN DEFAULT FALSE,

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加外键约束（在表创建之后）
ALTER TABLE public.comments
ADD CONSTRAINT fk_comments_user_id
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.comments
ADD CONSTRAINT fk_comments_parent_id
FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;

-- 添加检查约束
ALTER TABLE public.comments
ADD CONSTRAINT check_comment_author CHECK (
    (is_anonymous = TRUE AND author_name IS NOT NULL AND author_email IS NOT NULL) OR
    (is_anonymous = FALSE AND user_id IS NOT NULL)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_comments_post_slug ON public.comments(post_slug);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_approved ON public.comments(is_approved);

-- 创建更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为用户表创建更新时间戳触发器
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 为评论表创建更新时间戳触发器
CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON public.comments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 创建用户注册时自动创建用户资料的触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建用户注册触发器
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 启用行级安全 (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 用户表的 RLS 策略
-- 用户可以查看所有活跃用户的公开信息
CREATE POLICY "Public users are viewable by everyone" ON public.users
    FOR SELECT USING (is_active = TRUE);

-- 用户只能更新自己的资料
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- 用户可以插入自己的资料（通过触发器自动处理）
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 评论表的 RLS 策略
-- 所有人都可以查看已批准的评论
CREATE POLICY "Approved comments are viewable by everyone" ON public.comments
    FOR SELECT USING (is_approved = TRUE);

-- 所有人都可以插入评论（匿名或登录用户）
CREATE POLICY "Anyone can insert comments" ON public.comments
    FOR INSERT WITH CHECK (TRUE);

-- 登录用户可以更新自己的评论
CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE USING (
        auth.uid() = user_id AND is_anonymous = FALSE
    );

-- 登录用户可以删除自己的评论
CREATE POLICY "Users can delete own comments" ON public.comments
    FOR DELETE USING (
        auth.uid() = user_id AND is_anonymous = FALSE
    );

-- 管理员策略（需要在 Supabase 控制台中设置管理员角色）
-- 这里先预留，后续可以通过 Supabase 控制台配置

-- 插入一些示例数据（可选）
-- INSERT INTO public.comments (
--     post_slug, 
--     author_name, 
--     author_email, 
--     content, 
--     is_anonymous, 
--     is_approved
-- ) VALUES (
--     'test-post',
--     '测试用户',
--     'test@example.com',
--     '这是一条测试评论，用于验证数据库配置是否正确。',
--     TRUE,
--     TRUE
-- );

-- 创建视图以简化查询
CREATE OR REPLACE VIEW public.comments_with_user AS
SELECT 
    c.*,
    CASE 
        WHEN c.is_anonymous = FALSE THEN u.display_name
        ELSE c.author_name
    END as display_name,
    CASE 
        WHEN c.is_anonymous = FALSE THEN u.avatar_url
        ELSE c.avatar_url
    END as final_avatar_url,
    u.username,
    u.website as user_website
FROM public.comments c
LEFT JOIN public.users u ON c.user_id = u.id
WHERE c.is_approved = TRUE
ORDER BY c.created_at DESC;

-- 授予必要的权限
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.comments TO anon, authenticated;
GRANT SELECT ON public.comments_with_user TO anon, authenticated;
