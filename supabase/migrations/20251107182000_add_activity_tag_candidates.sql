create table if not exists public.activity_tag_candidates (
  "id" text not null,
  "name" text not null,
  "slug" text not null,
  "occurrences" integer not null default 1,
  "createdAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
  "lastSeenAt" timestamp(3) without time zone not null default CURRENT_TIMESTAMP,
  "lastSeenActivityId" text
);

alter table public.activity_tag_candidates
  add constraint activity_tag_candidates_pkey primary key ("id");

create unique index if not exists activity_tag_candidates_slug_key
  on public.activity_tag_candidates ("slug");

create index if not exists activity_tag_candidates_last_seen_idx
  on public.activity_tag_candidates ("lastSeenAt" DESC);

alter table public.activity_tag_candidates
  add constraint activity_tag_candidates_last_seen_activity_id_fkey
  foreign key ("lastSeenActivityId")
  references public.activities("id")
  on delete set null;
