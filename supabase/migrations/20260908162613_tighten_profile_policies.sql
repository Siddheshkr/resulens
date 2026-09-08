drop policy if exists "Users can view their own profile" on public.profiles;
drop policy if exists "Users can create their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can delete their own profile" on public.profiles;

create policy "Users can view their own profile"
  on public.profiles
  for select
  to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can create their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can delete their own profile"
  on public.profiles
  for delete
  to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Webhook events are worker-only"
  on public.clerk_webhook_events
  for all
  to authenticated
  using (false)
  with check (false);
