-- 创建点赞表
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

-- 创建策略：允许所有人查看点赞数据
CREATE POLICY "Allow public read access" ON public.likes
    FOR SELECT USING (true);

-- 创建策略：允许所有人插入点赞数据
CREATE POLICY "Allow public insert access" ON public.likes
    FOR INSERT WITH CHECK (true);

-- 创建策略：允许用户删除自己的点赞
CREATE POLICY "Allow users to delete own likes" ON public.likes
    FOR DELETE USING (
        user_ip = (SELECT inet_client_addr()::text) OR
        user_id = auth.uid()
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
CREATE TRIGGER update_likes_updated_at 
    BEFORE UPDATE ON public.likes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
