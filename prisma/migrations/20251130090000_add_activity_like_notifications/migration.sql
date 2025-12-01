-- Add activityId to notifications for activity like targets
ALTER TABLE "public"."notifications"
ADD COLUMN IF NOT EXISTS "activityId" TEXT;

ALTER TABLE "public"."notifications"
ADD CONSTRAINT IF NOT EXISTS "notifications_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "public"."activities"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "notifications_activityId_idx"
ON "public"."notifications"("activityId");
