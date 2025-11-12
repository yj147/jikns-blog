drop index if exists "public"."activities_authorId_idx";

alter table "public"."activities" add column "commentsCount" integer not null default 0;

alter table "public"."activities" add column "deletedAt" timestamp(3) without time zone;

alter table "public"."activities" add column "isDeleted" boolean not null default false;

alter table "public"."activities" add column "likesCount" integer not null default 0;

alter table "public"."activities" add column "viewsCount" integer not null default 0;

CREATE INDEX "activities_authorId_createdAt_idx" ON public.activities USING btree ("authorId", "createdAt" DESC);

CREATE INDEX "activities_isDeleted_createdAt_idx" ON public.activities USING btree ("isDeleted", "createdAt" DESC);

CREATE INDEX "activities_isPinned_createdAt_idx" ON public.activities USING btree ("isPinned", "createdAt" DESC);

CREATE INDEX "bookmarks_userId_createdAt_idx" ON public.bookmarks USING btree ("userId", "createdAt" DESC);


