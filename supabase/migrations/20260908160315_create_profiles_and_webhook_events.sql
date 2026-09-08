create table public.profiles (
  user_id text primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create policy "Users can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

create policy "Users can delete their own profile"
  on public.profiles
  for delete
  to authenticated
  using ((select auth.jwt()->>'sub') = user_id);

create table public.clerk_webhook_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz
);

alter table public.clerk_webhook_events enable row level security;
revoke all on table public.clerk_webhook_events from anon, authenticated;
