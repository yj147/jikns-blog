-- Migration: Add system_settings table
-- Purpose: Store application configuration (SEO, registration toggle, etc.)
-- Date: 2025-12-01

CREATE TABLE IF NOT EXISTS public.system_settings (
  key           text PRIMARY KEY,
  value         jsonb NOT NULL,
  category      text,
  description   text,
  "updatedById" text REFERENCES public.users(id) ON DELETE SET NULL,
  "createdAt"   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  "updatedAt"   timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write system settings
CREATE POLICY "system_settings_admin_all" ON public.system_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()::text AND role = 'ADMIN'
    )
  );

-- Service role has full access
CREATE POLICY "system_settings_service_role" ON public.system_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
