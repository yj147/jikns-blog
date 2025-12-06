-- Add coverImage column for user profile cover images
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS "coverImage" text;
