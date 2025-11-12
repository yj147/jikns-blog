drop index if exists "public"."follows_followerId_idx";

drop index if exists "public"."follows_followingId_idx";

CREATE INDEX "follows_followerId_createdAt_idx" ON public.follows USING btree ("followerId", "createdAt");

CREATE INDEX "follows_followingId_createdAt_idx" ON public.follows USING btree ("followingId", "createdAt");
