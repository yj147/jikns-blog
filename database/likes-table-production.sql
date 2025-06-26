-- 创建点赞表（生产环境版本）
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_slug VARCHAR(255) NOT NULL,
    user_ip VARCHAR(45),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_likes_post_slug ON public.likes(post_slug);
CREATE INDEX IF NOT EXISTS idx_likes_user_ip ON public.likes(user_ip);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON public.likes(created_at);

-- 创建唯一约束防止重复点赞（基于IP）
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_unique_ip 
ON public.likes(post_slug, user_ip) 
WHERE user_id IS NULL;

-- 创建唯一约束防止重复点赞（基于用户ID）
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_unique_user 
ON public.likes(post_slug, user_id) 
WHERE user_id IS NOT NULL;

-- 启用行级安全策略
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 删除现有策略（如果存在）
DROP POLICY IF EXISTS "Allow public read access" ON public.likes;
DROP POLICY IF EXISTS "Allow public insert access" ON public.likes;
DROP POLICY IF EXISTS "Allow users to delete own likes" ON public.likes;

-- 创建策略：允许所有人查看点赞数据
CREATE POLICY "Allow public read access" ON public.likes
    FOR SELECT USING (true);

-- 创建策略：允许所有人插入点赞数据
CREATE POLICY "Allow public insert access" ON public.likes
    FOR INSERT WITH CHECK (true);

-- 创建策略：允许用户删除自己的点赞（简化版本）
CREATE POLICY "Allow delete own likes" ON public.likes
    FOR DELETE USING (
        -- 允许基于用户ID删除
        (user_id IS NOT NULL AND user_id = auth.uid()) OR
        -- 允许基于IP删除（匿名用户）
        (user_id IS NULL AND user_ip IS NOT NULL)
    );

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建触发器
DROP TRIGGER IF EXISTS update_likes_updated_at ON public.likes;
CREATE TRIGGER update_likes_updated_at 
    BEFORE UPDATE ON public.likes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 创建视图用于统计
CREATE OR REPLACE VIEW public.post_like_stats AS
SELECT 
    post_slug,
    COUNT(*) as total_likes,
    COUNT(DISTINCT user_ip) as unique_ip_likes,
    COUNT(DISTINCT user_id) as unique_user_likes,
    MAX(created_at) as last_liked_at
FROM public.likes
GROUP BY post_slug;

-- 授予视图查看权限
GRANT SELECT ON public.post_like_stats TO anon, authenticated;

-- 验证表创建
SELECT 'Likes table and policies created successfully' as status;
