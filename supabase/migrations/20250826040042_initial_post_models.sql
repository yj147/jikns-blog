create type "public"."Role" as enum ('USER', 'ADMIN');

create type "public"."UserStatus" as enum ('ACTIVE', 'BANNED');


  create table "public"."activities" (
    "id" text not null,
    "content" text not null,
    "imageUrls" jsonb,
    "isPinned" boolean not null default false,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone not null,
    "authorId" text not null
      );



  create table "public"."bookmarks" (
    "id" text not null,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
    "userId" text not null,
    "postId" text not null
      );



  create table "public"."comments" (
    "id" text not null,
    "content" text not null,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone not null,
    "authorId" text not null,
    "postId" text,
    "activityId" text,
    "parentId" text
      );



  create table "public"."follows" (
    "followerId" text not null,
    "followingId" text not null,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."likes" (
    "id" text not null,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
    "authorId" text not null,
    "postId" text,
    "activityId" text
      );



  create table "public"."post_tags" (
    "postId" text not null,
    "tagId" text not null,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP
      );



  create table "public"."posts" (
    "id" text not null,
    "slug" text not null,
    "title" text not null,
    "content" text not null,
    "excerpt" text,
    "published" boolean not null default false,
    "isPinned" boolean not null default false,
    "canonicalUrl" text,
    "seoTitle" text,
    "seoDescription" text,
    "viewCount" integer not null default 0,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone not null,
    "publishedAt" timestamp(3) without time zone,
    "authorId" text not null,
    "seriesId" text
      );



  create table "public"."series" (
    "id" text not null,
    "title" text not null,
    "slug" text not null,
    "description" text,
    "coverUrl" text,
    "sortOrder" integer not null default 0,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone not null,
    "authorId" text not null
      );



  create table "public"."tags" (
    "id" text not null,
    "name" text not null,
    "slug" text not null,
    "description" text,
    "color" text,
    "postsCount" integer not null default 0,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone not null
      );



  create table "public"."users" (
    "id" text not null,
    "email" text not null,
    "name" text,
    "avatarUrl" text,
    "bio" text,
    "socialLinks" jsonb,
    "role" "Role" not null default 'USER'::"Role",
    "status" "UserStatus" not null default 'ACTIVE'::"UserStatus",
    "passwordHash" text,
    "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
    "updatedAt" timestamp(3) without time zone not null,
    "lastLoginAt" timestamp(3) without time zone
      );


CREATE INDEX "activities_authorId_idx" ON public.activities USING btree ("authorId");

CREATE INDEX "activities_createdAt_idx" ON public.activities USING btree ("createdAt" DESC);

CREATE UNIQUE INDEX activities_pkey ON public.activities USING btree (id);

CREATE UNIQUE INDEX bookmarks_pkey ON public.bookmarks USING btree (id);

CREATE INDEX "bookmarks_postId_idx" ON public.bookmarks USING btree ("postId");

CREATE INDEX "bookmarks_userId_idx" ON public.bookmarks USING btree ("userId");

CREATE UNIQUE INDEX "bookmarks_userId_postId_key" ON public.bookmarks USING btree ("userId", "postId");

CREATE INDEX "comments_activityId_idx" ON public.comments USING btree ("activityId");

CREATE INDEX "comments_authorId_idx" ON public.comments USING btree ("authorId");

CREATE INDEX "comments_createdAt_idx" ON public.comments USING btree ("createdAt" DESC);

CREATE INDEX "comments_parentId_idx" ON public.comments USING btree ("parentId");

CREATE UNIQUE INDEX comments_pkey ON public.comments USING btree (id);

CREATE INDEX "comments_postId_idx" ON public.comments USING btree ("postId");

CREATE INDEX "follows_followerId_idx" ON public.follows USING btree ("followerId");

CREATE INDEX "follows_followingId_idx" ON public.follows USING btree ("followingId");

CREATE UNIQUE INDEX follows_pkey ON public.follows USING btree ("followerId", "followingId");

CREATE INDEX "likes_activityId_idx" ON public.likes USING btree ("activityId");

CREATE UNIQUE INDEX "likes_authorId_activityId_key" ON public.likes USING btree ("authorId", "activityId");

CREATE INDEX "likes_authorId_idx" ON public.likes USING btree ("authorId");

CREATE UNIQUE INDEX "likes_authorId_postId_key" ON public.likes USING btree ("authorId", "postId");

CREATE UNIQUE INDEX likes_pkey ON public.likes USING btree (id);

CREATE INDEX "likes_postId_idx" ON public.likes USING btree ("postId");

CREATE UNIQUE INDEX post_tags_pkey ON public.post_tags USING btree ("postId", "tagId");

CREATE INDEX "posts_authorId_idx" ON public.posts USING btree ("authorId");

CREATE UNIQUE INDEX posts_pkey ON public.posts USING btree (id);

CREATE INDEX "posts_published_publishedAt_idx" ON public.posts USING btree (published, "publishedAt" DESC);

CREATE INDEX "posts_seriesId_idx" ON public.posts USING btree ("seriesId");

CREATE UNIQUE INDEX posts_slug_key ON public.posts USING btree (slug);

CREATE INDEX "series_authorId_idx" ON public.series USING btree ("authorId");

CREATE UNIQUE INDEX series_pkey ON public.series USING btree (id);

CREATE UNIQUE INDEX series_slug_key ON public.series USING btree (slug);

CREATE UNIQUE INDEX tags_name_key ON public.tags USING btree (name);

CREATE UNIQUE INDEX tags_pkey ON public.tags USING btree (id);

CREATE INDEX "tags_postsCount_idx" ON public.tags USING btree ("postsCount" DESC);

CREATE UNIQUE INDEX tags_slug_key ON public.tags USING btree (slug);

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);

CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

alter table "public"."activities" add constraint "activities_pkey" PRIMARY KEY using index "activities_pkey";

alter table "public"."bookmarks" add constraint "bookmarks_pkey" PRIMARY KEY using index "bookmarks_pkey";

alter table "public"."comments" add constraint "comments_pkey" PRIMARY KEY using index "comments_pkey";

alter table "public"."follows" add constraint "follows_pkey" PRIMARY KEY using index "follows_pkey";

alter table "public"."likes" add constraint "likes_pkey" PRIMARY KEY using index "likes_pkey";

alter table "public"."post_tags" add constraint "post_tags_pkey" PRIMARY KEY using index "post_tags_pkey";

alter table "public"."posts" add constraint "posts_pkey" PRIMARY KEY using index "posts_pkey";

alter table "public"."series" add constraint "series_pkey" PRIMARY KEY using index "series_pkey";

alter table "public"."tags" add constraint "tags_pkey" PRIMARY KEY using index "tags_pkey";

alter table "public"."users" add constraint "users_pkey" PRIMARY KEY using index "users_pkey";

alter table "public"."activities" add constraint "activities_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."activities" validate constraint "activities_authorId_fkey";

alter table "public"."bookmarks" add constraint "bookmarks_postId_fkey" FOREIGN KEY ("postId") REFERENCES posts(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."bookmarks" validate constraint "bookmarks_postId_fkey";

alter table "public"."bookmarks" add constraint "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."bookmarks" validate constraint "bookmarks_userId_fkey";

alter table "public"."comments" add constraint "comments_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES activities(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_activityId_fkey";

alter table "public"."comments" add constraint "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_authorId_fkey";

alter table "public"."comments" add constraint "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES comments(id) ON UPDATE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_parentId_fkey";

alter table "public"."comments" add constraint "comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES posts(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."comments" validate constraint "comments_postId_fkey";

alter table "public"."follows" add constraint "follows_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."follows" validate constraint "follows_followerId_fkey";

alter table "public"."follows" add constraint "follows_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."follows" validate constraint "follows_followingId_fkey";

alter table "public"."likes" add constraint "likes_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES activities(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."likes" validate constraint "likes_activityId_fkey";

alter table "public"."likes" add constraint "likes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."likes" validate constraint "likes_authorId_fkey";

alter table "public"."likes" add constraint "likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES posts(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."likes" validate constraint "likes_postId_fkey";

alter table "public"."post_tags" add constraint "post_tags_postId_fkey" FOREIGN KEY ("postId") REFERENCES posts(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."post_tags" validate constraint "post_tags_postId_fkey";

alter table "public"."post_tags" add constraint "post_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES tags(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."post_tags" validate constraint "post_tags_tagId_fkey";

alter table "public"."posts" add constraint "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."posts" validate constraint "posts_authorId_fkey";

alter table "public"."posts" add constraint "posts_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES series(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."posts" validate constraint "posts_seriesId_fkey";

alter table "public"."series" add constraint "series_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."series" validate constraint "series_authorId_fkey";

grant delete on table "public"."activities" to "anon";

grant insert on table "public"."activities" to "anon";

grant references on table "public"."activities" to "anon";

grant select on table "public"."activities" to "anon";

grant trigger on table "public"."activities" to "anon";

grant truncate on table "public"."activities" to "anon";

grant update on table "public"."activities" to "anon";

grant delete on table "public"."activities" to "authenticated";

grant insert on table "public"."activities" to "authenticated";

grant references on table "public"."activities" to "authenticated";

grant select on table "public"."activities" to "authenticated";

grant trigger on table "public"."activities" to "authenticated";

grant truncate on table "public"."activities" to "authenticated";

grant update on table "public"."activities" to "authenticated";

grant delete on table "public"."activities" to "service_role";

grant insert on table "public"."activities" to "service_role";

grant references on table "public"."activities" to "service_role";

grant select on table "public"."activities" to "service_role";

grant trigger on table "public"."activities" to "service_role";

grant truncate on table "public"."activities" to "service_role";

grant update on table "public"."activities" to "service_role";

grant delete on table "public"."bookmarks" to "anon";

grant insert on table "public"."bookmarks" to "anon";

grant references on table "public"."bookmarks" to "anon";

grant select on table "public"."bookmarks" to "anon";

grant trigger on table "public"."bookmarks" to "anon";

grant truncate on table "public"."bookmarks" to "anon";

grant update on table "public"."bookmarks" to "anon";

grant delete on table "public"."bookmarks" to "authenticated";

grant insert on table "public"."bookmarks" to "authenticated";

grant references on table "public"."bookmarks" to "authenticated";

grant select on table "public"."bookmarks" to "authenticated";

grant trigger on table "public"."bookmarks" to "authenticated";

grant truncate on table "public"."bookmarks" to "authenticated";

grant update on table "public"."bookmarks" to "authenticated";

grant delete on table "public"."bookmarks" to "service_role";

grant insert on table "public"."bookmarks" to "service_role";

grant references on table "public"."bookmarks" to "service_role";

grant select on table "public"."bookmarks" to "service_role";

grant trigger on table "public"."bookmarks" to "service_role";

grant truncate on table "public"."bookmarks" to "service_role";

grant update on table "public"."bookmarks" to "service_role";

grant delete on table "public"."comments" to "anon";

grant insert on table "public"."comments" to "anon";

grant references on table "public"."comments" to "anon";

grant select on table "public"."comments" to "anon";

grant trigger on table "public"."comments" to "anon";

grant truncate on table "public"."comments" to "anon";

grant update on table "public"."comments" to "anon";

grant delete on table "public"."comments" to "authenticated";

grant insert on table "public"."comments" to "authenticated";

grant references on table "public"."comments" to "authenticated";

grant select on table "public"."comments" to "authenticated";

grant trigger on table "public"."comments" to "authenticated";

grant truncate on table "public"."comments" to "authenticated";

grant update on table "public"."comments" to "authenticated";

grant delete on table "public"."comments" to "service_role";

grant insert on table "public"."comments" to "service_role";

grant references on table "public"."comments" to "service_role";

grant select on table "public"."comments" to "service_role";

grant trigger on table "public"."comments" to "service_role";

grant truncate on table "public"."comments" to "service_role";

grant update on table "public"."comments" to "service_role";

grant delete on table "public"."follows" to "anon";

grant insert on table "public"."follows" to "anon";

grant references on table "public"."follows" to "anon";

grant select on table "public"."follows" to "anon";

grant trigger on table "public"."follows" to "anon";

grant truncate on table "public"."follows" to "anon";

grant update on table "public"."follows" to "anon";

grant delete on table "public"."follows" to "authenticated";

grant insert on table "public"."follows" to "authenticated";

grant references on table "public"."follows" to "authenticated";

grant select on table "public"."follows" to "authenticated";

grant trigger on table "public"."follows" to "authenticated";

grant truncate on table "public"."follows" to "authenticated";

grant update on table "public"."follows" to "authenticated";

grant delete on table "public"."follows" to "service_role";

grant insert on table "public"."follows" to "service_role";

grant references on table "public"."follows" to "service_role";

grant select on table "public"."follows" to "service_role";

grant trigger on table "public"."follows" to "service_role";

grant truncate on table "public"."follows" to "service_role";

grant update on table "public"."follows" to "service_role";

grant delete on table "public"."likes" to "anon";

grant insert on table "public"."likes" to "anon";

grant references on table "public"."likes" to "anon";

grant select on table "public"."likes" to "anon";

grant trigger on table "public"."likes" to "anon";

grant truncate on table "public"."likes" to "anon";

grant update on table "public"."likes" to "anon";

grant delete on table "public"."likes" to "authenticated";

grant insert on table "public"."likes" to "authenticated";

grant references on table "public"."likes" to "authenticated";

grant select on table "public"."likes" to "authenticated";

grant trigger on table "public"."likes" to "authenticated";

grant truncate on table "public"."likes" to "authenticated";

grant update on table "public"."likes" to "authenticated";

grant delete on table "public"."likes" to "service_role";

grant insert on table "public"."likes" to "service_role";

grant references on table "public"."likes" to "service_role";

grant select on table "public"."likes" to "service_role";

grant trigger on table "public"."likes" to "service_role";

grant truncate on table "public"."likes" to "service_role";

grant update on table "public"."likes" to "service_role";

grant delete on table "public"."post_tags" to "anon";

grant insert on table "public"."post_tags" to "anon";

grant references on table "public"."post_tags" to "anon";

grant select on table "public"."post_tags" to "anon";

grant trigger on table "public"."post_tags" to "anon";

grant truncate on table "public"."post_tags" to "anon";

grant update on table "public"."post_tags" to "anon";

grant delete on table "public"."post_tags" to "authenticated";

grant insert on table "public"."post_tags" to "authenticated";

grant references on table "public"."post_tags" to "authenticated";

grant select on table "public"."post_tags" to "authenticated";

grant trigger on table "public"."post_tags" to "authenticated";

grant truncate on table "public"."post_tags" to "authenticated";

grant update on table "public"."post_tags" to "authenticated";

grant delete on table "public"."post_tags" to "service_role";

grant insert on table "public"."post_tags" to "service_role";

grant references on table "public"."post_tags" to "service_role";

grant select on table "public"."post_tags" to "service_role";

grant trigger on table "public"."post_tags" to "service_role";

grant truncate on table "public"."post_tags" to "service_role";

grant update on table "public"."post_tags" to "service_role";

grant delete on table "public"."posts" to "anon";

grant insert on table "public"."posts" to "anon";

grant references on table "public"."posts" to "anon";

grant select on table "public"."posts" to "anon";

grant trigger on table "public"."posts" to "anon";

grant truncate on table "public"."posts" to "anon";

grant update on table "public"."posts" to "anon";

grant delete on table "public"."posts" to "authenticated";

grant insert on table "public"."posts" to "authenticated";

grant references on table "public"."posts" to "authenticated";

grant select on table "public"."posts" to "authenticated";

grant trigger on table "public"."posts" to "authenticated";

grant truncate on table "public"."posts" to "authenticated";

grant update on table "public"."posts" to "authenticated";

grant delete on table "public"."posts" to "service_role";

grant insert on table "public"."posts" to "service_role";

grant references on table "public"."posts" to "service_role";

grant select on table "public"."posts" to "service_role";

grant trigger on table "public"."posts" to "service_role";

grant truncate on table "public"."posts" to "service_role";

grant update on table "public"."posts" to "service_role";

grant delete on table "public"."series" to "anon";

grant insert on table "public"."series" to "anon";

grant references on table "public"."series" to "anon";

grant select on table "public"."series" to "anon";

grant trigger on table "public"."series" to "anon";

grant truncate on table "public"."series" to "anon";

grant update on table "public"."series" to "anon";

grant delete on table "public"."series" to "authenticated";

grant insert on table "public"."series" to "authenticated";

grant references on table "public"."series" to "authenticated";

grant select on table "public"."series" to "authenticated";

grant trigger on table "public"."series" to "authenticated";

grant truncate on table "public"."series" to "authenticated";

grant update on table "public"."series" to "authenticated";

grant delete on table "public"."series" to "service_role";

grant insert on table "public"."series" to "service_role";

grant references on table "public"."series" to "service_role";

grant select on table "public"."series" to "service_role";

grant trigger on table "public"."series" to "service_role";

grant truncate on table "public"."series" to "service_role";

grant update on table "public"."series" to "service_role";

grant delete on table "public"."tags" to "anon";

grant insert on table "public"."tags" to "anon";

grant references on table "public"."tags" to "anon";

grant select on table "public"."tags" to "anon";

grant trigger on table "public"."tags" to "anon";

grant truncate on table "public"."tags" to "anon";

grant update on table "public"."tags" to "anon";

grant delete on table "public"."tags" to "authenticated";

grant insert on table "public"."tags" to "authenticated";

grant references on table "public"."tags" to "authenticated";

grant select on table "public"."tags" to "authenticated";

grant trigger on table "public"."tags" to "authenticated";

grant truncate on table "public"."tags" to "authenticated";

grant update on table "public"."tags" to "authenticated";

grant delete on table "public"."tags" to "service_role";

grant insert on table "public"."tags" to "service_role";

grant references on table "public"."tags" to "service_role";

grant select on table "public"."tags" to "service_role";

grant trigger on table "public"."tags" to "service_role";

grant truncate on table "public"."tags" to "service_role";

grant update on table "public"."tags" to "service_role";

grant delete on table "public"."users" to "anon";

grant insert on table "public"."users" to "anon";

grant references on table "public"."users" to "anon";

grant select on table "public"."users" to "anon";

grant trigger on table "public"."users" to "anon";

grant truncate on table "public"."users" to "anon";

grant update on table "public"."users" to "anon";

grant delete on table "public"."users" to "authenticated";

grant insert on table "public"."users" to "authenticated";

grant references on table "public"."users" to "authenticated";

grant select on table "public"."users" to "authenticated";

grant trigger on table "public"."users" to "authenticated";

grant truncate on table "public"."users" to "authenticated";

grant update on table "public"."users" to "authenticated";

grant delete on table "public"."users" to "service_role";

grant insert on table "public"."users" to "service_role";

grant references on table "public"."users" to "service_role";

grant select on table "public"."users" to "service_role";

grant trigger on table "public"."users" to "service_role";

grant truncate on table "public"."users" to "service_role";

grant update on table "public"."users" to "service_role";


