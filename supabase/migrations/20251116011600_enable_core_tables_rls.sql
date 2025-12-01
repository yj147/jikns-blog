-- Enable Row Level Security for core tables
-- 为核心表启用行级别安全策略
-- Generated on 2025-11-16

-- ============================================================================
-- 1. Users Table RLS
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 所有人可查看用户公开信息
CREATE POLICY "users_select_public"
  ON public.users
  FOR SELECT
  USING (true);

-- 用户只能更新自己的资料
CREATE POLICY "users_update_self"
  ON public.users
  FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- 管理员可以更新任何用户
CREATE POLICY "users_update_admin"
  ON public.users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================================================
-- 2. Posts Table RLS
-- ============================================================================
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- 所有人可查看已发布文章，作者可查看自己的草稿
CREATE POLICY "posts_select_published_or_own"
  ON public.posts
  FOR SELECT
  USING (
    published = true
    OR auth.uid()::text = "authorId"
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- 只有管理员可创建文章
CREATE POLICY "posts_insert_admin"
  ON public.posts
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- 作者和管理员可更新文章
CREATE POLICY "posts_update_author_or_admin"
  ON public.posts
  FOR UPDATE
  USING (
    auth.uid()::text = "authorId"
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- 作者和管理员可删除文章
CREATE POLICY "posts_delete_author_or_admin"
  ON public.posts
  FOR DELETE
  USING (
    auth.uid()::text = "authorId"
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================================================
-- 3. Comments Table RLS
-- ============================================================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- 所有人可查看未删除的评论
CREATE POLICY "comments_select_not_deleted"
  ON public.comments
  FOR SELECT
  USING ("deletedAt" IS NULL);

-- 认证用户可创建评论
CREATE POLICY "comments_insert_authenticated"
  ON public.comments
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = "authorId"
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND status = 'ACTIVE'
    )
  );

-- 作者可更新自己的评论（用于编辑功能）
CREATE POLICY "comments_update_author"
  ON public.comments
  FOR UPDATE
  USING (
    auth.uid()::text = "authorId"
    AND "deletedAt" IS NULL
  );

-- 作者和管理员可删除评论（软删除通过UPDATE实现）
CREATE POLICY "comments_delete_author_or_admin"
  ON public.comments
  FOR DELETE
  USING (
    auth.uid()::text = "authorId"
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================================================
-- 4. Activities Table RLS
-- ============================================================================
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- 所有人可查看未删除的动态
CREATE POLICY "activities_select_not_deleted"
  ON public.activities
  FOR SELECT
  USING (
    "deletedAt" IS NULL
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- 认证活跃用户可创建动态
CREATE POLICY "activities_insert_authenticated"
  ON public.activities
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = "authorId"
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND status = 'ACTIVE'
    )
  );

-- 作者可更新自己的动态
CREATE POLICY "activities_update_author"
  ON public.activities
  FOR UPDATE
  USING (auth.uid()::text = "authorId");

-- 作者和管理员可删除动态
CREATE POLICY "activities_delete_author_or_admin"
  ON public.activities
  FOR DELETE
  USING (
    auth.uid()::text = "authorId"
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================================================
-- 5. Likes Table RLS
-- ============================================================================
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- 所有人可查看点赞
CREATE POLICY "likes_select_all"
  ON public.likes
  FOR SELECT
  USING (true);

-- 用户只能创建自己的点赞
CREATE POLICY "likes_insert_self"
  ON public.likes
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = "authorId"
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND status = 'ACTIVE'
    )
  );

-- 用户只能删除自己的点赞
CREATE POLICY "likes_delete_self"
  ON public.likes
  FOR DELETE
  USING (auth.uid()::text = "authorId");

-- ============================================================================
-- 6. Bookmarks Table RLS
-- ============================================================================
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的收藏
CREATE POLICY "bookmarks_select_own"
  ON public.bookmarks
  FOR SELECT
  USING (auth.uid()::text = "userId");

-- 用户只能创建自己的收藏
CREATE POLICY "bookmarks_insert_self"
  ON public.bookmarks
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = "userId"
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND status = 'ACTIVE'
    )
  );

-- 用户只能删除自己的收藏
CREATE POLICY "bookmarks_delete_self"
  ON public.bookmarks
  FOR DELETE
  USING (auth.uid()::text = "userId");

-- ============================================================================
-- 7. Post Tags Table RLS (关联表)
-- ============================================================================
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

-- 所有人可查看文章标签关联
CREATE POLICY "post_tags_select_all"
  ON public.post_tags
  FOR SELECT
  USING (true);

-- 只有管理员可以管理文章标签
CREATE POLICY "post_tags_insert_admin"
  ON public.post_tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

CREATE POLICY "post_tags_delete_admin"
  ON public.post_tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================================================
-- 8. Tags Table RLS
-- ============================================================================
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- 所有人可查看标签
CREATE POLICY "tags_select_all"
  ON public.tags
  FOR SELECT
  USING (true);

-- 只有管理员可以创建/更新/删除标签
CREATE POLICY "tags_insert_admin"
  ON public.tags
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

CREATE POLICY "tags_update_admin"
  ON public.tags
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

CREATE POLICY "tags_delete_admin"
  ON public.tags
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================================================
-- 9. Series Table RLS
-- ============================================================================
ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

-- 所有人可查看系列
CREATE POLICY "series_select_all"
  ON public.series
  FOR SELECT
  USING (true);

-- 只有管理员可以创建系列
CREATE POLICY "series_insert_admin"
  ON public.series
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- 作者和管理员可更新系列
CREATE POLICY "series_update_author_or_admin"
  ON public.series
  FOR UPDATE
  USING (
    auth.uid()::text = "authorId"
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- 作者和管理员可删除系列
CREATE POLICY "series_delete_author_or_admin"
  ON public.series
  FOR DELETE
  USING (
    auth.uid()::text = "authorId"
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- ============================================================================
-- 10. 授予必要的权限
-- ============================================================================

-- 撤销匿名用户的写权限
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.posts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.comments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.activities FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.likes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.bookmarks FROM anon;

-- 授予认证用户读权限
GRANT SELECT ON public.users TO authenticated;
GRANT SELECT ON public.posts TO authenticated;
GRANT SELECT ON public.comments TO authenticated;
GRANT SELECT ON public.activities TO authenticated;
GRANT SELECT ON public.likes TO authenticated;
GRANT SELECT ON public.bookmarks TO authenticated;
GRANT SELECT ON public.tags TO authenticated;
GRANT SELECT ON public.series TO authenticated;
GRANT SELECT ON public.post_tags TO authenticated;

-- Service Role 保持完全权限（用于应用层操作）
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================================================
-- 注释说明
-- ============================================================================
--
-- 本迁移启用了所有核心表的行级别安全策略（RLS），实现数据库层面的访问控制：
--
-- 1. Users: 所有人可查看，用户只能修改自己的资料
-- 2. Posts: 公开查看已发布文章，管理员管理权限
-- 3. Comments: 公开查看未删除评论，作者和管理员可删除
-- 4. Activities: 公开查看未删除动态，作者可管理
-- 5. Likes/Bookmarks: 用户只能管理自己的数据
-- 6. Tags/Series: 公开查看，管理员管理
--
-- 注意事项：
-- - Service Role Key 仍可绕过 RLS（用于应用层权限控制）
-- - 现有使用 Prisma 的代码大多通过 Service Role 连接，不受 RLS 影响
-- - RLS 主要保护直接数据库访问和通过 Supabase Client 的访问
-- - 如需应用层也使用 RLS，需将 Prisma 配置改为使用 anon/authenticated key
