-- Secure the public.follows table with row level security and least privilege grants
-- Generated on 2025-11-03 to address missing RLS protections

alter table public.follows enable row level security;

-- Enforce least privilege: only authenticated and service roles require direct table access.
revoke all on table public.follows from anon;
revoke all on table public.follows from authenticated;

grant select on table public.follows to authenticated;
grant all on table public.follows to service_role;

create policy "follows_select_relationship"
  on public.follows
  for select
  using (
    auth.uid()::text = "followerId"
    or auth.uid()::text = "followingId"
  );

create policy "follows_insert_self"
  on public.follows
  for insert
  with check (
    auth.uid()::text = "followerId"
  );

create policy "follows_delete_self"
  on public.follows
  for delete
  using (
    auth.uid()::text = "followerId"
  );
