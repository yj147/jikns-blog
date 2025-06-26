-- 创建点赞表（简化版本）
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_slug VARCHAR(255) NOT NULL,
    user_ip VARCHAR(45),
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_likes_post_slug ON public.likes(post_slug);
CREATE INDEX IF NOT EXISTS idx_likes_user_ip ON public.likes(user_ip);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);

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

-- 创建简化的策略：允许所有操作（适合开发环境）
CREATE POLICY "Allow all operations on likes" ON public.likes
    FOR ALL USING (true) WITH CHECK (true);

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

-- 测试插入数据
INSERT INTO public.likes (post_slug, user_ip) 
VALUES ('test-slug', '127.0.0.1')
ON CONFLICT DO NOTHING;

-- 验证表创建
SELECT 'Likes table created successfully' as status;
