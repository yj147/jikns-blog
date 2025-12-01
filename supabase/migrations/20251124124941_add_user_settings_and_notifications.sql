-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('LIKE', 'COMMENT', 'FOLLOW', 'SYSTEM');

-- AlterTable: Add user settings fields
ALTER TABLE "public"."users"
  ADD COLUMN IF NOT EXISTS "location" TEXT,
  ADD COLUMN IF NOT EXISTS "notificationPreferences" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "privacySettings" JSONB NOT NULL DEFAULT '{}';

-- CreateTable: Notifications
CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postId" TEXT,
    "commentId" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_recipientId_readAt_idx"
  ON "public"."notifications"("recipientId", "readAt");

-- AddForeignKey
ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "public"."users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "public"."posts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."notifications"
  ADD CONSTRAINT "notifications_commentId_fkey"
  FOREIGN KEY ("commentId") REFERENCES "public"."comments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
