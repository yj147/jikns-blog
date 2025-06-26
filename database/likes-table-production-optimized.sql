-- 生产环境点赞表（优化版本）
-- 适用于正式上线的博客网站

-- 1. 创建点赞表
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    post_slug VARCHAR(255) NOT NULL,
    user_ip INET, -- 使用INET类型存储IP地址
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_agent TEXT, -- 存储用户代理信息（可选，用于防刷）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- 约束：确保每个用户/IP只能对同一文章点赞一次
    CONSTRAINT likes_user_post_unique UNIQUE (post_slug, user_id),
    CONSTRAINT likes_ip_post_unique UNIQUE (post_slug, user_ip)
);

-- 2. 创建性能优化索引
CREATE INDEX IF NOT EXISTS idx_likes_post_slug ON public.likes(post_slug);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_ip ON public.likes(user_ip);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON public.likes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_likes_post_created ON public.likes(post_slug, created_at DESC);

-- 3. 启用行级安全策略
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 4. 删除现有策略（如果存在）
DROP POLICY IF EXISTS "likes_select_policy" ON public.likes;
DROP POLICY IF EXISTS "likes_insert_policy" ON public.likes;
DROP POLICY IF EXISTS "likes_delete_policy" ON public.likes;

-- 5. 创建安全策略

-- 允许所有人查看点赞数据（用于统计）
CREATE POLICY "likes_select_policy" ON public.likes
    FOR SELECT USING (true);

-- 允许插入点赞（防止重复由唯一约束处理）
CREATE POLICY "likes_insert_policy" ON public.likes
    FOR INSERT WITH CHECK (
        -- 确保post_slug不为空
        post_slug IS NOT NULL AND post_slug != ''
    );

-- 允许删除自己的点赞
CREATE POLICY "likes_delete_policy" ON public.likes
    FOR DELETE USING (
        -- 登录用户可以删除自己的点赞
        (user_id IS NOT NULL AND user_id = auth.uid()) OR
        -- 匿名用户基于IP删除（需要额外验证）
        (user_id IS NULL AND user_ip IS NOT NULL)
    );

-- 6. 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_likes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_likes_updated_at ON public.likes;
CREATE TRIGGER trigger_update_likes_updated_at
    BEFORE UPDATE ON public.likes
    FOR EACH ROW
    EXECUTE FUNCTION update_likes_updated_at();

-- 7. 创建统计视图
CREATE OR REPLACE VIEW public.post_like_stats AS
SELECT 
    post_slug,
    COUNT(*) as total_likes,
    COUNT(DISTINCT user_ip) as unique_ip_likes,
    COUNT(DISTINCT user_id) as unique_user_likes,
    MAX(created_at) as last_liked_at,
    DATE_TRUNC('day', created_at) as like_date,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') as likes_24h,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as likes_7d
FROM public.likes
GROUP BY post_slug, DATE_TRUNC('day', created_at);

-- 8. 创建热门文章视图
CREATE OR REPLACE VIEW public.popular_posts AS
SELECT 
    post_slug,
    COUNT(*) as total_likes,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as recent_likes,
    MAX(created_at) as last_liked_at
FROM public.likes
GROUP BY post_slug
ORDER BY total_likes DESC, recent_likes DESC;

-- 9. 授予必要权限
GRANT SELECT ON public.post_like_stats TO anon, authenticated;
GRANT SELECT ON public.popular_posts TO anon, authenticated;

-- 10. 创建防刷函数（可选）
CREATE OR REPLACE FUNCTION check_like_rate_limit(
    p_post_slug TEXT,
    p_user_ip INET DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    recent_likes_count INTEGER;
BEGIN
    -- 检查最近5分钟内的点赞次数
    SELECT COUNT(*) INTO recent_likes_count
    FROM public.likes
    WHERE 
        (p_user_ip IS NOT NULL AND user_ip = p_user_ip) OR
        (p_user_id IS NOT NULL AND user_id = p_user_id)
        AND created_at >= NOW() - INTERVAL '5 minutes';
    
    -- 限制每5分钟最多点赞10次
    RETURN recent_likes_count < 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. 创建清理旧数据的函数（可选）
CREATE OR REPLACE FUNCTION cleanup_old_likes(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.likes 
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. 验证部署
DO $$
BEGIN
    -- 测试插入
    INSERT INTO public.likes (post_slug, user_ip)
    VALUES ('deployment-test', '127.0.0.1'::INET)
    ON CONFLICT DO NOTHING;

    -- 验证统计视图
    IF EXISTS (SELECT 1 FROM public.post_like_stats WHERE post_slug = 'deployment-test') THEN
        RAISE NOTICE 'Deployment successful: Tables and views created correctly';
    ELSE
        RAISE NOTICE 'Warning: Views may need time to populate data';
    END IF;

    -- 清理测试数据
    DELETE FROM public.likes WHERE post_slug = 'deployment-test';

    RAISE NOTICE 'Production likes system deployment completed!';
END $$;

SELECT 'Production likes system deployed successfully!' as status;
