-- Supabase 数据库初始化脚本（修复版）
-- 支持匿名评论和登录用户评论的混合系统
-- 分步执行以避免依赖问题

-- 第一步：启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 第二步：创建用户表（扩展 Supabase Auth 的用户信息）
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

-- 第三步：创建评论表（不包含外键约束）
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

-- 第四步：添加外键约束
DO $$
BEGIN
    -- 添加用户外键约束
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_comments_user_id'
    ) THEN
        ALTER TABLE public.comments 
        ADD CONSTRAINT fk_comments_user_id 
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;

    -- 添加父评论外键约束
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_comments_parent_id'
    ) THEN
        ALTER TABLE public.comments 
        ADD CONSTRAINT fk_comments_parent_id 
        FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;
    END IF;

    -- 添加检查约束
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'check_comment_author'
    ) THEN
        ALTER TABLE public.comments 
        ADD CONSTRAINT check_comment_author CHECK (
            (is_anonymous = TRUE AND author_name IS NOT NULL AND author_email IS NOT NULL) OR
            (is_anonymous = FALSE AND user_id IS NOT NULL)
        );
    END IF;
END $$;

-- 第五步：创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_comments_post_slug ON public.comments(post_slug);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON public.comments(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_approved ON public.comments(is_approved);

-- 第六步：创建更新时间戳的触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 第七步：为用户表创建更新时间戳触发器
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON public.users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 第八步：为评论表创建更新时间戳触发器
DROP TRIGGER IF EXISTS update_comments_updated_at ON public.comments;
CREATE TRIGGER update_comments_updated_at 
    BEFORE UPDATE ON public.comments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 第九步：创建用户注册时自动创建用户资料的触发器函数
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
EXCEPTION
    WHEN unique_violation THEN
        -- 用户已存在，忽略错误
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 第十步：创建用户注册触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 第十一步：启用行级安全 (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 第十二步：创建 RLS 策略

-- 用户表的 RLS 策略
DROP POLICY IF EXISTS "Public users are viewable by everyone" ON public.users;
CREATE POLICY "Public users are viewable by everyone" ON public.users
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 评论表的 RLS 策略
DROP POLICY IF EXISTS "Approved comments are viewable by everyone" ON public.comments;
CREATE POLICY "Approved comments are viewable by everyone" ON public.comments
    FOR SELECT USING (is_approved = TRUE);

DROP POLICY IF EXISTS "Anyone can insert comments" ON public.comments;
CREATE POLICY "Anyone can insert comments" ON public.comments
    FOR INSERT WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE USING (
        auth.uid() = user_id AND is_anonymous = FALSE
    );

DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;
CREATE POLICY "Users can delete own comments" ON public.comments
    FOR DELETE USING (
        auth.uid() = user_id AND is_anonymous = FALSE
    );

-- 第十三步：创建视图以简化查询
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

-- 第十四步：授予必要的权限
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.comments TO anon, authenticated;
GRANT SELECT ON public.comments_with_user TO anon, authenticated;

-- 完成提示
DO $$
BEGIN
    RAISE NOTICE '✅ Supabase 数据库初始化完成！';
    RAISE NOTICE '📊 已创建表：users, comments';
    RAISE NOTICE '🔐 已配置行级安全策略';
    RAISE NOTICE '⚡ 已创建索引和触发器';
    RAISE NOTICE '🎯 数据库已准备就绪，可以开始使用评论系统！';
END $$;
