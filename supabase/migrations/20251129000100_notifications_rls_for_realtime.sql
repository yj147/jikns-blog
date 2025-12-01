-- Enable RLS and policies for notifications table
-- Required for Supabase Realtime to work properly
-- Generated on 2025-11-29

-- ============================================================================
-- 启用 RLS
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS 策略
-- ============================================================================

-- 用户只能查看自己的通知（SELECT 用于 Realtime 订阅）
CREATE POLICY "notifications_select_own"
  ON public.notifications
  FOR SELECT
  USING (auth.uid()::text = "recipientId");

-- 用户只能更新自己的通知（标记已读）
CREATE POLICY "notifications_update_own"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid()::text = "recipientId")
  WITH CHECK (auth.uid()::text = "recipientId");

-- 服务端可以插入通知（通过 service role）
-- 不需要 INSERT 策略，因为通知由服务端创建

-- ============================================================================
-- 注释说明
-- ============================================================================
--
-- 本迁移为 notifications 表启用 RLS，确保：
-- 1. 用户只能订阅自己的通知（Realtime SELECT 过滤）
-- 2. 用户只能标记自己的通知为已读
-- 3. 通知创建由服务端（service role）完成，绕过 RLS
--
