-- Migration: Data integrity constraints for performance_metrics and notifications
-- Date: 2025-12-02 10:00:01

-- Clean orphan performance metrics before adding FK
DELETE FROM public.performance_metrics pm
WHERE pm."userId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = pm."userId"
  );

-- Add foreign key and index for performance_metrics.userId
ALTER TABLE public.performance_metrics
ADD CONSTRAINT fk_performance_metrics_user
FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_performance_metrics_userid
  ON public.performance_metrics("userId");

-- Enforce target exclusivity on notifications
ALTER TABLE public.notifications
ADD CONSTRAINT chk_notifications_target_exclusive
CHECK (num_nonnulls("postId", "commentId", "activityId") <= 1);

-- ============================================================================
-- DOWN MIGRATION (回滚脚本)
-- ============================================================================
-- 如需回滚，执行以下 SQL：
--
-- -- 1) 移除 notifications 互斥约束
-- ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS chk_notifications_target_exclusive;
--
-- -- 2) 移除 performance_metrics 外键和索引
-- ALTER TABLE public.performance_metrics DROP CONSTRAINT IF EXISTS fk_performance_metrics_user;
-- DROP INDEX IF EXISTS idx_performance_metrics_userid;
--
-- 注意：已清理的孤儿数据无法恢复
-- ============================================================================
