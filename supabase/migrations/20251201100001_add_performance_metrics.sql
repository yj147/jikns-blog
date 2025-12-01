-- Migration: Add performance_metrics table
-- Purpose: Store API response times and performance data
-- Date: 2025-12-01

-- Create MetricType enum
DO $$ BEGIN
  CREATE TYPE public."MetricType" AS ENUM (
    'api_response',
    'db_query',
    'cache_hit',
    'external_api',
    'auth_login',
    'auth_session',
    'permission_check'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id          text PRIMARY KEY,
  type        public."MetricType" NOT NULL,
  value       double precision NOT NULL,
  unit        text NOT NULL,
  timestamp   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  context     jsonb,
  tags        text[] NOT NULL DEFAULT '{}',
  "requestId" text,
  "userId"    text
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "performance_metrics_type_timestamp_idx"
  ON public.performance_metrics (type, timestamp DESC);

CREATE INDEX IF NOT EXISTS "performance_metrics_tags_idx"
  ON public.performance_metrics USING GIN (tags);

-- Enable RLS
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Only admins can read performance metrics
CREATE POLICY "performance_metrics_admin_select" ON public.performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- Service role has full access (for writing from backend)
CREATE POLICY "performance_metrics_service_role" ON public.performance_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
