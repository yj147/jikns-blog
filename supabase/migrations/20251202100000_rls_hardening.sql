-- Supabase RLS Hardening
-- Date: 2025-12-02 10:00:00

-- ============================================================================
-- 1) 移除 anon 权限
-- ============================================================================
REVOKE SELECT ON public.users FROM anon;
REVOKE SELECT ON public.comments FROM anon;
REVOKE ALL ON public.likes FROM anon;
REVOKE ALL ON public.activity_tags FROM anon;
REVOKE SELECT ON public.post_tags FROM anon;
REVOKE SELECT ON public.tags FROM anon;
REVOKE SELECT ON public.series FROM anon;

-- ============================================================================
-- 2) users：仅 authenticated 可读公开字段，service_role 全量
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- 列权限改为仅 authenticated 可读白名单
REVOKE SELECT ON public.users FROM PUBLIC;
REVOKE SELECT ON public.users FROM authenticated;
GRANT SELECT (id, name, "avatarUrl", bio, "createdAt") ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

-- 替换 SELECT 策略（移除 anon）
DROP POLICY IF EXISTS "users_select_public" ON public.users;
DROP POLICY IF EXISTS "users_select_public_whitelist" ON public.users;
DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_service_role" ON public.users;

CREATE POLICY "users_select_authenticated_public"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "users_select_service_role"
  ON public.users
  FOR SELECT
  TO service_role
  USING (true);

-- ============================================================================
-- 3) comments：仅认证用户可读，作者/管理员可写
-- ============================================================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_not_deleted" ON public.comments;
DROP POLICY IF EXISTS "comments_insert_authenticated" ON public.comments;
DROP POLICY IF EXISTS "comments_update_author" ON public.comments;
DROP POLICY IF EXISTS "comments_delete_author_or_admin" ON public.comments;

CREATE POLICY "comments_select_authenticated_not_deleted"
  ON public.comments
  FOR SELECT
  TO authenticated
  USING ("deletedAt" IS NULL);

CREATE POLICY "comments_insert_authenticated"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = "authorId"
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND status = 'ACTIVE'
    )
  );

CREATE POLICY "comments_update_author_or_admin"
  ON public.comments
  FOR UPDATE
  TO authenticated
  USING (
    "deletedAt" IS NULL
    AND (
      auth.uid()::text = "authorId"
      OR public.is_admin_user(auth.uid()::text)
    )
  )
  WITH CHECK (
    "deletedAt" IS NULL
    AND (
      auth.uid()::text = "authorId"
      OR public.is_admin_user(auth.uid()::text)
    )
  );

CREATE POLICY "comments_delete_author_or_admin"
  ON public.comments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = "authorId"
    OR public.is_admin_user(auth.uid()::text)
  );

CREATE POLICY "comments_all_service_role"
  ON public.comments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4) likes：仅本人读写，认证 + service_role
-- ============================================================================
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_all" ON public.likes;
DROP POLICY IF EXISTS "likes_insert_self" ON public.likes;
DROP POLICY IF EXISTS "likes_delete_self" ON public.likes;

CREATE POLICY "likes_select_self_authenticated"
  ON public.likes
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = "authorId");

CREATE POLICY "likes_insert_self_authenticated"
  ON public.likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid()::text = "authorId"
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND status = 'ACTIVE'
    )
  );

CREATE POLICY "likes_delete_self_authenticated"
  ON public.likes
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = "authorId");

CREATE POLICY "likes_all_service_role"
  ON public.likes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 5) activity_tags：启用 RLS，认证可读，作者可写
-- ============================================================================
ALTER TABLE public.activity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_tags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activity_tags_select_all" ON public.activity_tags;
DROP POLICY IF EXISTS "activity_tags_insert_all" ON public.activity_tags;
DROP POLICY IF EXISTS "activity_tags_delete_all" ON public.activity_tags;

CREATE POLICY "activity_tags_select_authenticated"
  ON public.activity_tags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "activity_tags_insert_author"
  ON public.activity_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = "activityId"
        AND a."authorId" = auth.uid()::text
    )
  );

CREATE POLICY "activity_tags_delete_author"
  ON public.activity_tags
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = "activityId"
        AND a."authorId" = auth.uid()::text
    )
  );

CREATE POLICY "activity_tags_all_service_role"
  ON public.activity_tags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 6) post_tags：仅认证可读，管理员写；service_role 全量
-- ============================================================================
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_tags_select_all" ON public.post_tags;
DROP POLICY IF EXISTS "post_tags_insert_admin" ON public.post_tags;
DROP POLICY IF EXISTS "post_tags_delete_admin" ON public.post_tags;

CREATE POLICY "post_tags_select_authenticated"
  ON public.post_tags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "post_tags_insert_admin"
  ON public.post_tags
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()::text));

CREATE POLICY "post_tags_delete_admin"
  ON public.post_tags
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()::text));

CREATE POLICY "post_tags_all_service_role"
  ON public.post_tags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 7) tags：仅认证可读，管理员写；service_role 全量
-- ============================================================================
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_select_all" ON public.tags;
DROP POLICY IF EXISTS "tags_insert_admin" ON public.tags;
DROP POLICY IF EXISTS "tags_update_admin" ON public.tags;
DROP POLICY IF EXISTS "tags_delete_admin" ON public.tags;

CREATE POLICY "tags_select_authenticated"
  ON public.tags
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "tags_insert_admin"
  ON public.tags
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()::text));

CREATE POLICY "tags_update_admin"
  ON public.tags
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()::text))
  WITH CHECK (public.is_admin_user(auth.uid()::text));

CREATE POLICY "tags_delete_admin"
  ON public.tags
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()::text));

CREATE POLICY "tags_all_service_role"
  ON public.tags
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 8) series：仅认证可读，作者/管理员可写；service_role 全量
-- ============================================================================
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.series FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "series_select_all" ON public.series;
DROP POLICY IF EXISTS "series_insert_admin" ON public.series;
DROP POLICY IF EXISTS "series_update_author_or_admin" ON public.series;
DROP POLICY IF EXISTS "series_delete_author_or_admin" ON public.series;

CREATE POLICY "series_select_authenticated"
  ON public.series
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "series_insert_admin"
  ON public.series
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()::text));

CREATE POLICY "series_update_author_or_admin"
  ON public.series
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid()::text = "authorId"
    OR public.is_admin_user(auth.uid()::text)
  )
  WITH CHECK (
    auth.uid()::text = "authorId"
    OR public.is_admin_user(auth.uid()::text)
  );

CREATE POLICY "series_delete_author_or_admin"
  ON public.series
  FOR DELETE
  TO authenticated
  USING (
    auth.uid()::text = "authorId"
    OR public.is_admin_user(auth.uid()::text)
  );

CREATE POLICY "series_all_service_role"
  ON public.series
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 9) Grants：确保 service_role 完整权限，authenticated 读
-- ============================================================================
GRANT SELECT ON public.comments TO authenticated;
GRANT SELECT ON public.likes TO authenticated;
GRANT SELECT ON public.activity_tags TO authenticated;
GRANT SELECT ON public.post_tags TO authenticated;
GRANT SELECT ON public.tags TO authenticated;
GRANT SELECT ON public.series TO authenticated;

GRANT ALL ON public.comments TO service_role;
GRANT ALL ON public.likes TO service_role;
GRANT ALL ON public.activity_tags TO service_role;
GRANT ALL ON public.post_tags TO service_role;
GRANT ALL ON public.tags TO service_role;
GRANT ALL ON public.series TO service_role;

-- ============================================================================
-- DOWN MIGRATION (回滚脚本)
-- ============================================================================
-- 如需回滚，执行以下 SQL：
--
-- -- 1) 恢复 anon 权限
-- GRANT SELECT ON public.users TO anon;
-- GRANT SELECT ON public.comments TO anon;
-- GRANT ALL ON public.likes TO anon;
-- GRANT ALL ON public.activity_tags TO anon;
-- GRANT SELECT ON public.post_tags TO anon;
-- GRANT SELECT ON public.tags TO anon;
-- GRANT SELECT ON public.series TO anon;
--
-- -- 2) 恢复 users 列权限
-- GRANT SELECT ON public.users TO authenticated;
--
-- -- 3) 删除新策略并恢复旧策略
-- DROP POLICY IF EXISTS "users_select_authenticated_public" ON public.users;
-- DROP POLICY IF EXISTS "users_select_service_role" ON public.users;
-- CREATE POLICY "users_select_public" ON public.users FOR SELECT USING (true);
--
-- DROP POLICY IF EXISTS "comments_select_authenticated_not_deleted" ON public.comments;
-- DROP POLICY IF EXISTS "comments_insert_authenticated" ON public.comments;
-- DROP POLICY IF EXISTS "comments_update_author_or_admin" ON public.comments;
-- DROP POLICY IF EXISTS "comments_delete_author_or_admin" ON public.comments;
-- DROP POLICY IF EXISTS "comments_all_service_role" ON public.comments;
-- CREATE POLICY "comments_select_not_deleted" ON public.comments FOR SELECT USING ("deletedAt" IS NULL);
--
-- DROP POLICY IF EXISTS "likes_select_self_authenticated" ON public.likes;
-- DROP POLICY IF EXISTS "likes_insert_self_authenticated" ON public.likes;
-- DROP POLICY IF EXISTS "likes_delete_self_authenticated" ON public.likes;
-- DROP POLICY IF EXISTS "likes_all_service_role" ON public.likes;
-- CREATE POLICY "likes_select_all" ON public.likes FOR SELECT USING (true);
--
-- DROP POLICY IF EXISTS "activity_tags_select_authenticated" ON public.activity_tags;
-- DROP POLICY IF EXISTS "activity_tags_insert_author" ON public.activity_tags;
-- DROP POLICY IF EXISTS "activity_tags_delete_author" ON public.activity_tags;
-- DROP POLICY IF EXISTS "activity_tags_all_service_role" ON public.activity_tags;
-- CREATE POLICY "activity_tags_select_all" ON public.activity_tags FOR SELECT USING (true);
--
-- (其他表类似处理)
-- ============================================================================
