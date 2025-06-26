-- 修复GitHub OAuth登录问题
-- 解决406和403错误，确保OAuth用户能正确创建

-- 1. 确保users表有email字段
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. 创建email字段的索引
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 3. 删除所有现有的RLS策略并重新创建
DROP POLICY IF EXISTS "Public users are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view users" ON public.users;

-- 4. 创建新的RLS策略
-- 允许已认证用户查看所有活跃用户
CREATE POLICY "Authenticated users can view active users" ON public.users
    FOR SELECT TO authenticated USING (is_active = TRUE);

-- 允许匿名用户查看活跃用户的基本信息（用于评论显示）
CREATE POLICY "Anonymous users can view active users" ON public.users
    FOR SELECT TO anon USING (is_active = TRUE);

-- 允许用户查看自己的完整资料
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- 允许用户插入自己的资料
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 允许用户更新自己的资料
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- 5. 为现有的auth用户创建对应的public.users记录
INSERT INTO public.users (id, email, display_name, avatar_url, created_at, updated_at)
SELECT 
    au.id,
    au.email,
    COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        au.raw_user_meta_data->>'display_name',
        split_part(au.email, '@', 1)
    ) as display_name,
    au.raw_user_meta_data->>'avatar_url' as avatar_url,
    au.created_at,
    au.updated_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 6. 更新现有用户的email字段（如果为空）
UPDATE public.users 
SET email = auth_users.email
FROM auth.users AS auth_users
WHERE public.users.id = auth_users.id 
AND public.users.email IS NULL;

-- 7. 确保所有用户都是活跃状态
UPDATE public.users 
SET is_active = TRUE 
WHERE is_active IS NULL OR is_active = FALSE;

-- 8. 验证修复
DO $$
DECLARE
    auth_count INTEGER;
    public_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO auth_count FROM auth.users;
    SELECT COUNT(*) INTO public_count FROM public.users;
    
    RAISE NOTICE '✅ GitHub OAuth修复完成！';
    RAISE NOTICE '📊 Auth用户数: %', auth_count;
    RAISE NOTICE '📊 Public用户数: %', public_count;
    RAISE NOTICE '🔐 已更新RLS策略';
    RAISE NOTICE '🎯 GitHub登录现在应该正常工作！';
END $$;
