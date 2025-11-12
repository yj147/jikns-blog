-- Align Activity image storage and introduce Activity ↔ Tag join table

-- Step 1: 添加临时列
alter table "public"."activities"
  add column if not exists "imageUrls_temp" text[];

-- Step 2: 数据迁移 - 处理JSON到数组的转换
update "public"."activities"
  set "imageUrls_temp" = case
    when "imageUrls" is null then '{}'::text[]
    when jsonb_typeof("imageUrls"::jsonb) = 'array' then
      array(select jsonb_array_elements_text("imageUrls"::jsonb))
    else '{}'::text[]
  end;

-- Step 3: 删除旧列
alter table "public"."activities"
  drop column "imageUrls";

-- Step 4: 重命名临时列
alter table "public"."activities"
  rename column "imageUrls_temp" to "imageUrls";

alter table "public"."activities"
  alter column "imageUrls" set default '{}'::text[];

update "public"."activities"
  set "imageUrls" = '{}'::text[]
  where "imageUrls" is null;

alter table "public"."activities"
  alter column "imageUrls" set not null;

create table "public"."activity_tags" (
  "activityId" text not null,
  "tagId" text not null,
  "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP
      );

create index "activity_tags_activityId_idx" on "public"."activity_tags" ("activityId");
create index "activity_tags_tagId_idx" on "public"."activity_tags" ("tagId");

alter table "public"."activity_tags"
  add constraint "activity_tags_pkey" primary key ("activityId", "tagId");

alter table "public"."activity_tags"
  add constraint "activity_tags_activityId_fkey"
  foreign key ("activityId") references "public"."activities"("id") on update cascade on delete cascade;

alter table "public"."activity_tags"
  add constraint "activity_tags_tagId_fkey"
  foreign key ("tagId") references "public"."tags"("id") on update cascade on delete cascade;

grant delete on table "public"."activity_tags" to "anon";
grant insert on table "public"."activity_tags" to "anon";
grant references on table "public"."activity_tags" to "anon";
grant select on table "public"."activity_tags" to "anon";
grant trigger on table "public"."activity_tags" to "anon";
grant truncate on table "public"."activity_tags" to "anon";
grant update on table "public"."activity_tags" to "anon";

grant delete on table "public"."activity_tags" to "authenticated";
grant insert on table "public"."activity_tags" to "authenticated";
grant references on table "public"."activity_tags" to "authenticated";
grant select on table "public"."activity_tags" to "authenticated";
grant trigger on table "public"."activity_tags" to "authenticated";
grant truncate on table "public"."activity_tags" to "authenticated";
grant update on table "public"."activity_tags" to "authenticated";

grant delete on table "public"."activity_tags" to "service_role";
grant insert on table "public"."activity_tags" to "service_role";
grant references on table "public"."activity_tags" to "service_role";
grant select on table "public"."activity_tags" to "service_role";
grant trigger on table "public"."activity_tags" to "service_role";
grant truncate on table "public"."activity_tags" to "service_role";
grant update on table "public"."activity_tags" to "service_role";
