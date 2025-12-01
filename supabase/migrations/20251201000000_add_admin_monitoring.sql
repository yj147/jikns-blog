-- Migration: Add admin dashboard counters and realtime publication
-- Purpose: Provide aggregated counts for admin monitoring with automatic updates
-- Date: 2025-12-01

-- ============================================================================
-- 1) Create admin_dashboard_counters table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.admin_dashboard_counters (
  id               integer PRIMARY KEY DEFAULT 1,
  users_count      bigint  NOT NULL DEFAULT 0,
  posts_count      bigint  NOT NULL DEFAULT 0,
  comments_count   bigint  NOT NULL DEFAULT 0,
  activities_count bigint  NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 2) Trigger function to refresh counters
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_dashboard_counters()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.admin_dashboard_counters AS adc (
    id,
    users_count,
    posts_count,
    comments_count,
    activities_count,
    updated_at
  )
  VALUES (
    1,
    (SELECT COUNT(*) FROM public.users),
    (SELECT COUNT(*) FROM public.posts),
    (SELECT COUNT(*) FROM public.comments WHERE "deletedAt" IS NULL),
    (SELECT COUNT(*) FROM public.activities WHERE "deletedAt" IS NULL),
    timezone('utc', now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    users_count = EXCLUDED.users_count,
    posts_count = EXCLUDED.posts_count,
    comments_count = EXCLUDED.comments_count,
    activities_count = EXCLUDED.activities_count,
    updated_at = EXCLUDED.updated_at;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3) Attach triggers to source tables
-- ============================================================================

DROP TRIGGER IF EXISTS trg_update_dashboard_users ON public.users;
CREATE TRIGGER trg_update_dashboard_users
AFTER INSERT OR DELETE ON public.users
FOR EACH STATEMENT
EXECUTE FUNCTION public.update_dashboard_counters();

DROP TRIGGER IF EXISTS trg_update_dashboard_posts ON public.posts;
CREATE TRIGGER trg_update_dashboard_posts
AFTER INSERT OR DELETE ON public.posts
FOR EACH STATEMENT
EXECUTE FUNCTION public.update_dashboard_counters();

DROP TRIGGER IF EXISTS trg_update_dashboard_comments ON public.comments;
CREATE TRIGGER trg_update_dashboard_comments
AFTER INSERT OR DELETE OR UPDATE ON public.comments
FOR EACH STATEMENT
EXECUTE FUNCTION public.update_dashboard_counters();

DROP TRIGGER IF EXISTS trg_update_dashboard_activities ON public.activities;
CREATE TRIGGER trg_update_dashboard_activities
AFTER INSERT OR DELETE OR UPDATE ON public.activities
FOR EACH STATEMENT
EXECUTE FUNCTION public.update_dashboard_counters();

-- ============================================================================
-- 4) Seed initial counter snapshot
-- ============================================================================

INSERT INTO public.admin_dashboard_counters (
  id,
  users_count,
  posts_count,
  comments_count,
  activities_count,
  updated_at
)
VALUES (
  1,
  (SELECT COUNT(*) FROM public.users),
  (SELECT COUNT(*) FROM public.posts),
  (SELECT COUNT(*) FROM public.comments WHERE "deletedAt" IS NULL),
  (SELECT COUNT(*) FROM public.activities WHERE "deletedAt" IS NULL),
  timezone('utc', now())
)
ON CONFLICT (id) DO UPDATE
SET
  users_count = EXCLUDED.users_count,
  posts_count = EXCLUDED.posts_count,
  comments_count = EXCLUDED.comments_count,
  activities_count = EXCLUDED.activities_count,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- 5) Enable Realtime publication
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_dashboard_counters;

