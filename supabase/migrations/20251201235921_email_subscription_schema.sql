create type "public"."EmailQueueStatus" as enum ('PENDING', 'SENDING', 'SENT', 'FAILED');

create type "public"."EmailSubscriptionStatus" as enum ('PENDING', 'VERIFIED', 'UNSUBSCRIBED', 'BOUNCED');

-- 扩展通知枚举以支持邮件队列
alter type "public"."NotificationType" rename to "NotificationType__old_version_to_be_dropped";

create type "public"."NotificationType" as enum ('LIKE', 'COMMENT', 'FOLLOW', 'SYSTEM', 'NEW_POST');

create table "public"."email_queue" (
  "id" text not null,
  "subscriberId" text,
  "type" public."NotificationType" not null,
  "payload" jsonb not null,
  "scheduledAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
  "status" public."EmailQueueStatus" not null default 'PENDING'::public."EmailQueueStatus",
  "attempts" integer not null default 0,
  "lastError" text,
  "sentAt" timestamp(3) without time zone,
  "notificationId" text,
  "postId" text,
  "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP
);

create table "public"."email_subscribers" (
  "id" text not null,
  "email" text not null,
  "userId" text,
  "status" public."EmailSubscriptionStatus" not null default 'PENDING'::public."EmailSubscriptionStatus",
  "verifyTokenHash" text,
  "verifyExpiresAt" timestamp(3) without time zone,
  "unsubscribeTokenHash" text not null,
  "verifiedAt" timestamp(3) without time zone,
  "lastDigestAt" timestamp(3) without time zone,
  "preferences" jsonb not null default '{}'::jsonb,
  "source" text,
  "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) without time zone not null
);

alter table "public"."notifications"
  alter column "type" type "public"."NotificationType"
  using "type"::text::"public"."NotificationType";

drop type "public"."NotificationType__old_version_to_be_dropped";

CREATE UNIQUE INDEX email_queue_pkey ON public.email_queue USING btree (id);
CREATE INDEX "email_queue_status_scheduledAt_idx" ON public.email_queue USING btree (status, "scheduledAt");
CREATE INDEX email_queue_type_idx ON public.email_queue USING btree (type);

CREATE INDEX email_subscribers_email_idx ON public.email_subscribers USING btree (email);
CREATE UNIQUE INDEX email_subscribers_email_key ON public.email_subscribers USING btree (email);
CREATE UNIQUE INDEX email_subscribers_pkey ON public.email_subscribers USING btree (id);
CREATE INDEX email_subscribers_status_idx ON public.email_subscribers USING btree (status);
CREATE UNIQUE INDEX "email_subscribers_unsubscribeTokenHash_key" ON public.email_subscribers USING btree ("unsubscribeTokenHash");
CREATE UNIQUE INDEX "email_subscribers_verifyTokenHash_key" ON public.email_subscribers USING btree ("verifyTokenHash");

alter table "public"."email_queue" add constraint "email_queue_pkey" primary key using index "email_queue_pkey";
alter table "public"."email_subscribers" add constraint "email_subscribers_pkey" primary key using index "email_subscribers_pkey";

alter table "public"."email_queue" add constraint "email_queue_notificationId_fkey" foreign key ("notificationId") references public.notifications(id) on update cascade on delete set null not valid;
alter table "public"."email_queue" validate constraint "email_queue_notificationId_fkey";

alter table "public"."email_queue" add constraint "email_queue_postId_fkey" foreign key ("postId") references public.posts(id) on update cascade on delete set null not valid;
alter table "public"."email_queue" validate constraint "email_queue_postId_fkey";

alter table "public"."email_queue" add constraint "email_queue_subscriberId_fkey" foreign key ("subscriberId") references public.email_subscribers(id) on update cascade on delete set null not valid;
alter table "public"."email_queue" validate constraint "email_queue_subscriberId_fkey";

alter table "public"."email_subscribers" add constraint "email_subscribers_userId_fkey" foreign key ("userId") references public.users(id) on update cascade on delete set null not valid;
alter table "public"."email_subscribers" validate constraint "email_subscribers_userId_fkey";

grant delete on table "public"."email_queue" to "anon";
grant insert on table "public"."email_queue" to "anon";
grant references on table "public"."email_queue" to "anon";
grant select on table "public"."email_queue" to "anon";
grant trigger on table "public"."email_queue" to "anon";
grant truncate on table "public"."email_queue" to "anon";
grant update on table "public"."email_queue" to "anon";

grant delete on table "public"."email_queue" to "authenticated";
grant insert on table "public"."email_queue" to "authenticated";
grant references on table "public"."email_queue" to "authenticated";
grant select on table "public"."email_queue" to "authenticated";
grant trigger on table "public"."email_queue" to "authenticated";
grant truncate on table "public"."email_queue" to "authenticated";
grant update on table "public"."email_queue" to "authenticated";

grant delete on table "public"."email_queue" to "service_role";
grant insert on table "public"."email_queue" to "service_role";
grant references on table "public"."email_queue" to "service_role";
grant select on table "public"."email_queue" to "service_role";
grant trigger on table "public"."email_queue" to "service_role";
grant truncate on table "public"."email_queue" to "service_role";
grant update on table "public"."email_queue" to "service_role";

grant delete on table "public"."email_subscribers" to "anon";
grant insert on table "public"."email_subscribers" to "anon";
grant references on table "public"."email_subscribers" to "anon";
grant select on table "public"."email_subscribers" to "anon";
grant trigger on table "public"."email_subscribers" to "anon";
grant truncate on table "public"."email_subscribers" to "anon";
grant update on table "public"."email_subscribers" to "anon";

grant delete on table "public"."email_subscribers" to "authenticated";
grant insert on table "public"."email_subscribers" to "authenticated";
grant references on table "public"."email_subscribers" to "authenticated";
grant select on table "public"."email_subscribers" to "authenticated";
grant trigger on table "public"."email_subscribers" to "authenticated";
grant truncate on table "public"."email_subscribers" to "authenticated";
grant update on table "public"."email_subscribers" to "authenticated";

grant delete on table "public"."email_subscribers" to "service_role";
grant insert on table "public"."email_subscribers" to "service_role";
grant references on table "public"."email_subscribers" to "service_role";
grant select on table "public"."email_subscribers" to "service_role";
grant trigger on table "public"."email_subscribers" to "service_role";
grant truncate on table "public"."email_subscribers" to "service_role";
grant update on table "public"."email_subscribers" to "service_role";
