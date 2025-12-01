-- Migration: Add activityId to notifications for activity likes
-- Purpose: Support notifications when users like activities
-- Date: 2025-11-30

-- Add activityId column
ALTER TABLE "public"."notifications"
  ADD COLUMN IF NOT EXISTS "activityId" TEXT;

-- Add foreign key constraint
ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_activityId_fkey"
  FOREIGN KEY ("activityId") REFERENCES "public"."activities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Create index for activity notifications
CREATE INDEX IF NOT EXISTS "notifications_activityId_idx"
  ON "public"."notifications"("activityId");
