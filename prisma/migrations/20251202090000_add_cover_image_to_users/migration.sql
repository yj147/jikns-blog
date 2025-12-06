-- Add coverImage column to users for profile cover images
ALTER TABLE "public"."users"
ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
