-- Tighten users RLS: expose only public-safe columns to anon, keep self/admin full access
-- 日期: 2025-11-25

-- 1) 确保行级安全开启并强制执行
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- 2) 提供安全的管理员检测函数（避免策略自引用递归）
CREATE OR REPLACE FUNCTION public.is_admin_user(target_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = target_id
      AND u.role = 'ADMIN'
  );
END;
$$;

-- 3) 重置列权限，改为白名单
REVOKE SELECT ON public.users FROM PUBLIC;
REVOKE SELECT ON public.users FROM anon;
REVOKE SELECT ON public.users FROM authenticated;

GRANT SELECT (id, name, "avatarUrl", bio, "createdAt") ON public.users TO anon;
GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

-- 4) 替换 SELECT 策略
DROP POLICY IF EXISTS "users_select_public" ON public.users;
DROP POLICY IF EXISTS "users_select_public_whitelist" ON public.users;
DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_service_role" ON public.users;

-- 匿名/公开：只能读取白名单列（由列级权限限制）
CREATE POLICY "users_select_public_whitelist"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);

-- 认证用户：仅可读取自己的完整记录；管理员可读取所有记录
CREATE POLICY "users_select_self_or_admin"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid()::text = id
    OR public.is_admin_user(auth.uid()::text)
  );

-- Service role：保持完全访问（Prisma 依赖）
CREATE POLICY "users_select_service_role"
  ON public.users
  FOR SELECT
  TO service_role
  USING (true);

-- 5) 提供回滚函数（手动执行：SELECT public.rollback_20251125120000_tighten_users_rls();）
CREATE OR REPLACE FUNCTION public.rollback_20251125120000_tighten_users_rls()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DROP POLICY IF EXISTS "users_select_public_whitelist" ON public.users;
  DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;
  DROP POLICY IF EXISTS "users_select_service_role" ON public.users;

  ALTER TABLE public.users NO FORCE ROW LEVEL SECURITY;

  REVOKE SELECT (id, name, "avatarUrl", bio, "createdAt") ON public.users FROM anon;
  REVOKE SELECT ON public.users FROM anon;
  REVOKE SELECT ON public.users FROM authenticated;

  CREATE POLICY "users_select_public"
    ON public.users
    FOR SELECT
    USING (true);

  GRANT SELECT ON public.users TO authenticated;
  GRANT ALL ON public.users TO service_role;

  DROP FUNCTION IF EXISTS public.is_admin_user(text);
END;
$$;
