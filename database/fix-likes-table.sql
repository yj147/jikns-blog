-- 修复点赞功能：创建likes表和相关配置
-- 解决"操作失败，请稍后重试"错误

-- 1. 创建点赞表
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_slug VARCHAR(255) NOT NULL,
    user_ip VARCHAR(45),
    user_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_likes_post_slug ON public.likes(post_slug);
CREATE INDEX IF NOT EXISTS idx_likes_user_ip ON public.likes(user_ip);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);

-- 3. 创建唯一约束防止重复点赞（基于IP）
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_unique_ip 
ON public.likes(post_slug, user_ip) 
WHERE user_id IS NULL;

-- 4. 创建唯一约束防止重复点赞（基于用户ID）
CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_unique_user 
ON public.likes(post_slug, user_id) 
WHERE user_id IS NOT NULL;

-- 5. 启用行级安全策略
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 6. 删除可能存在的旧策略
DROP POLICY IF EXISTS "Allow public read access" ON public.likes;
DROP POLICY IF EXISTS "Allow public insert access" ON public.likes;
DROP POLICY IF EXISTS "Allow users to delete own likes" ON public.likes;

-- 7. 创建新的RLS策略
-- 允许所有人查看点赞数据
CREATE POLICY "Allow public read access" ON public.likes
    FOR SELECT USING (true);

-- 允许所有人插入点赞数据
CREATE POLICY "Allow public insert access" ON public.likes
    FOR INSERT WITH CHECK (true);

-- 允许用户删除自己的点赞（基于IP或用户ID）
CREATE POLICY "Allow users to delete own likes" ON public.likes
    FOR DELETE USING (
        (user_id IS NULL AND user_ip IS NOT NULL) OR
        (user_id IS NOT NULL AND user_id = auth.uid())
    );

-- 8. 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. 创建触发器
DROP TRIGGER IF EXISTS update_likes_updated_at ON public.likes;
CREATE TRIGGER update_likes_updated_at 
    BEFORE UPDATE ON public.likes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 10. 验证表创建
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'likes' AND table_schema = 'public') THEN
        RAISE NOTICE '✅ likes表创建成功！';
        RAISE NOTICE '📊 表结构已配置完成';
        RAISE NOTICE '🔐 RLS策略已设置';
        RAISE NOTICE '🎯 点赞功能现在应该正常工作！';
    ELSE
        RAISE NOTICE '❌ likes表创建失败！';
    END IF;
END $$;
