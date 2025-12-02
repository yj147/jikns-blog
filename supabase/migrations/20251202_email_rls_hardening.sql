-- Email tables RLS hardening
-- Date: 2025-12-02

-- ============================================================================
-- 1) Enable RLS and enforce
-- ============================================================================
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_subscribers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue FORCE ROW LEVEL SECURITY;

-- ============================================================================
-- 2) Revoke overly broad privileges (anon/auth) and keep service role explicit
-- ============================================================================
REVOKE ALL ON public.email_subscribers FROM PUBLIC;
REVOKE ALL ON public.email_subscribers FROM anon;
REVOKE ALL ON public.email_subscribers FROM authenticated;

REVOKE ALL ON public.email_queue FROM PUBLIC;
REVOKE ALL ON public.email_queue FROM anon;
REVOKE ALL ON public.email_queue FROM authenticated;

GRANT ALL ON public.email_subscribers TO service_role;
GRANT ALL ON public.email_queue TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.email_subscribers TO authenticated;

-- ============================================================================
-- 3) Policies: email_subscribers - authenticated users manage only their rows
-- ============================================================================
DROP POLICY IF EXISTS "email_subscribers_select_self" ON public.email_subscribers;
DROP POLICY IF EXISTS "email_subscribers_insert_self" ON public.email_subscribers;
DROP POLICY IF EXISTS "email_subscribers_update_self" ON public.email_subscribers;
DROP POLICY IF EXISTS "email_subscribers_all_service_role" ON public.email_subscribers;

CREATE POLICY "email_subscribers_select_self"
  ON public.email_subscribers
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid()::text);

CREATE POLICY "email_subscribers_insert_self"
  ON public.email_subscribers
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "email_subscribers_update_self"
  ON public.email_subscribers
  FOR UPDATE
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "email_subscribers_all_service_role"
  ON public.email_subscribers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4) Policies: email_queue - service_role only
-- ============================================================================
DROP POLICY IF EXISTS "email_queue_service_role_only" ON public.email_queue;

CREATE POLICY "email_queue_service_role_only"
  ON public.email_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
