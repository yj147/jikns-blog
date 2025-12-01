-- Enable Realtime for core tables
-- 为核心表启用实时订阅功能
-- Generated on 2025-11-16

-- ============================================================================
-- 启用表的 Realtime 发布
-- ============================================================================

-- 评论表实时更新（高优先级）
ALTER publication supabase_realtime ADD TABLE public.comments;

-- 动态表实时更新
ALTER publication supabase_realtime ADD TABLE public.activities;

-- 点赞表实时更新
ALTER publication supabase_realtime ADD TABLE public.likes;

-- 收藏表实时更新（用户个人）
ALTER publication supabase_realtime ADD TABLE public.bookmarks;

-- 关注关系实时更新
ALTER publication supabase_realtime ADD TABLE public.follows;

-- ============================================================================
-- 注释说明
-- ============================================================================
--
-- 本迁移启用了核心交互表的 Realtime 功能，实现：
--
-- 1. Comments - 评论实时推送（新评论、删除、更新）
-- 2. Activities - 动态实时推送
-- 3. Likes - 点赞实时同步
-- 4. Bookmarks - 收藏实时同步
-- 5. Follows - 关注关系实时更新
--
-- 使用方式：
-- - 客户端通过 Supabase Realtime 订阅这些表的变更
-- - 配合 RLS 策略，确保用户只能订阅有权限查看的数据
--
-- 性能考虑：
-- - Posts 表不启用 Realtime（更新频率低，通过刷新即可）
-- - Users 表不启用 Realtime（隐私敏感，通过API更新即可）
