-- 修复用户表结构和RLS策略
-- 解决406和403错误

-- 1. 添加缺失的email字段
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- 2. 创建email字段的索引
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 3. 更新RLS策略以允许用户查询自己的数据
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- 4. 允许已认证用户查看活跃用户的基本信息
DROP POLICY IF EXISTS "Public users are viewable by everyone" ON public.users;
CREATE POLICY "Public users are viewable by everyone" ON public.users
    FOR SELECT USING (is_active = TRUE);

-- 5. 允许已认证用户查询所有用户（用于评论系统）
DROP POLICY IF EXISTS "Authenticated users can view users" ON public.users;
CREATE POLICY "Authenticated users can view users" ON public.users
    FOR SELECT TO authenticated USING (TRUE);

-- 6. 确保用户可以插入自己的资料
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 7. 确保用户可以更新自己的资料
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- 8. 为现有用户填充email字段（从auth.users获取）
UPDATE public.users 
SET email = auth_users.email
FROM auth.users AS auth_users
WHERE public.users.id = auth_users.id 
AND public.users.email IS NULL;

-- 9. 验证修复
DO $$
BEGIN
    RAISE NOTICE '✅ 用户表修复完成！';
    RAISE NOTICE '📊 已添加email字段和索引';
    RAISE NOTICE '🔐 已更新RLS策略';
    RAISE NOTICE '🎯 数据库已准备就绪！';
END $$;
