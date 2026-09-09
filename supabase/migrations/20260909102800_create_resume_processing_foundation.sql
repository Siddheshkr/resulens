-- Phase 2 resume intake and processing foundation.
-- Raw files remain in the private `resumes` Storage bucket. Database rows store
-- only bounded metadata and the extracted, user-reviewable profile.

create extension if not exists pgcrypto;
create extension if not exists pgmq;

-- The queue contains only opaque identifiers. Resume bytes and extracted
-- profile data remain in private Storage/database rows.
select pgmq.create('resume_processing');

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(user_id) on delete cascade,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  status text not null default 'pending_upload' check (status in (
    'pending_upload', 'uploaded', 'queued', 'processing', 'needs_review',
    'approved', 'failed', 'deleting', 'delete_failed', 'deleted'
  )),
  processing_stage text not null default 'upload' check (processing_stage in (
    'upload', 'queued', 'validating', 'extracting', 'structuring', 'review',
    'approved', 'deleting', 'complete', 'failed'
  )),
  page_count integer check (page_count is null or (page_count between 1 and 5)),
  extracted_character_count integer check (extracted_character_count is null or extracted_character_count >= 0),
  latest_profile_version integer check (latest_profile_version is null or latest_profile_version > 0),
  approved_profile_version integer check (approved_profile_version is null or approved_profile_version > 0),
  derived_profile_version integer check (derived_profile_version is null or derived_profile_version > 0),
  ai_processing_consent_at timestamptz not null,
  upload_completed_at timestamptz,
  retry_count smallint not null default 0 check (retry_count between 0 and 3),
  next_retry_at timestamptz,
  error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 500),
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (id, user_id)
);

create index resumes_user_created_idx on public.resumes (user_id, created_at desc);
create index resumes_status_retry_idx on public.resumes (status, next_retry_at);

create table public.resume_profiles (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null,
  user_id text not null references public.profiles(user_id) on delete cascade,
  version integer not null check (version > 0),
  status text not null check (status in ('draft', 'approved')),
  profile jsonb not null,
  schema_version text not null,
  prompt_version text not null,
  model text,
  source_mode text not null check (source_mode in ('text', 'vision', 'manual')),
  average_confidence numeric(5, 4) check (average_confidence is null or (average_confidence between 0 and 1)),
  approved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (resume_id, version),
  foreign key (resume_id, user_id) references public.resumes(id, user_id) on delete cascade
);

create index resume_profiles_user_idx on public.resume_profiles (user_id, resume_id, version desc);
create index resume_profiles_resume_status_idx on public.resume_profiles (resume_id, status);

create table public.resume_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null,
  user_id text not null references public.profiles(user_id) on delete cascade,
  kind text not null default 'extract_profile' check (kind = 'extract_profile'),
  status text not null default 'queued' check (status in ('queued', 'processing', 'succeeded', 'failed')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 3),
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  last_error_message text check (last_error_message is null or char_length(last_error_message) <= 500),
  provider_model text,
  input_tokens integer,
  output_tokens integer,
  latency_ms integer,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  foreign key (resume_id, user_id) references public.resumes(id, user_id) on delete cascade
);

create unique index resume_processing_active_job_idx
  on public.resume_processing_jobs (resume_id, kind)
  where status in ('queued', 'processing');
create index resume_processing_queue_idx
  on public.resume_processing_jobs (status, available_at, created_at);

-- The relational table is the processing ledger and ownership boundary. The
-- pgmq queue below is the delivery boundary consumed by the bounded Edge
-- Function. Keeping both lets the UI read safe status without exposing queue
-- messages or worker credentials.

alter table public.resumes enable row level security;
alter table public.resume_profiles enable row level security;
alter table public.resume_processing_jobs enable row level security;

revoke all on table public.resumes, public.resume_profiles, public.resume_processing_jobs from anon, authenticated;
grant select, insert, update, delete on table public.resumes to authenticated;
grant select, insert, update, delete on table public.resume_profiles to authenticated;
grant insert on table public.resume_processing_jobs to authenticated;

create policy "Users can view their own resumes"
  on public.resumes for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can create their own resumes"
  on public.resumes for insert to authenticated
  with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can update their own resumes"
  on public.resumes for update to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can delete their own resumes"
  on public.resumes for delete to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can view their own resume profiles"
  on public.resume_profiles for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can create their own resume profiles"
  on public.resume_profiles for insert to authenticated
  with check (
    ((select auth.jwt()) ->> 'sub') = user_id
    and exists (
      select 1 from public.resumes
      where public.resumes.id = resume_id
        and public.resumes.user_id = user_id
    )
  );

create policy "Users can update their own resume profiles"
  on public.resume_profiles for update to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (
    ((select auth.jwt()) ->> 'sub') = user_id
    and exists (
      select 1 from public.resumes
      where public.resumes.id = resume_id
        and public.resumes.user_id = user_id
    )
  );

create policy "Users can delete their own resume profiles"
  on public.resume_profiles for delete to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

-- The browser never reads or updates queue rows. Insert is allowed only for a
-- row owned by the caller; worker reads and transitions use service_role.
create policy "Users can enqueue their own resume processing"
  on public.resume_processing_jobs for insert to authenticated
  with check (
    ((select auth.jwt()) ->> 'sub') = user_id
    and exists (
      select 1 from public.resumes
      where public.resumes.id = resume_id
        and public.resumes.user_id = user_id
    )
  );

-- Queue wrappers are intentionally service-role-only. Authenticated requests
-- first pass Clerk authorization in the Next.js route, then use the admin
-- client to enqueue an identifier after the ledger row exists.
create or replace function public.enqueue_resume_processing(
  p_resume_id uuid,
  p_job_id uuid,
  p_delay_seconds integer default 0
)
returns bigint
language sql
security definer
set search_path = pgmq, pg_catalog
as $$
  select pgmq.send(
    'resume_processing',
    jsonb_build_object('resume_id', p_resume_id, 'job_id', p_job_id),
    greatest(0, least(coalesce(p_delay_seconds, 0), 86400))
  )
  limit 1;
$$;

create or replace function public.read_resume_processing(
  p_visibility_timeout integer default 300,
  p_limit integer default 3
)
returns jsonb
language sql
security definer
set search_path = pgmq, pg_catalog
as $$
  select coalesce(jsonb_agg(to_jsonb(message_row)), '[]'::jsonb)
  from pgmq.read(
    'resume_processing',
    greatest(30, least(coalesce(p_visibility_timeout, 300), 900)),
    greatest(1, least(coalesce(p_limit, 3), 3))
  ) as message_row;
$$;

create or replace function public.ack_resume_processing(p_message_id bigint)
returns boolean
language sql
security definer
set search_path = pgmq, pg_catalog
as $$
  select pgmq.delete('resume_processing', p_message_id);
$$;

revoke all on function public.enqueue_resume_processing(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.read_resume_processing(integer, integer) from public, anon, authenticated;
revoke all on function public.ack_resume_processing(bigint) from public, anon, authenticated;
grant execute on function public.enqueue_resume_processing(uuid, uuid, integer) to service_role;
grant execute on function public.read_resume_processing(integer, integer) to service_role;
grant execute on function public.ack_resume_processing(bigint) to service_role;

-- Private bucket with a provider-enforced five megabyte PDF limit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880, array['application/pdf']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own resume objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = ((select auth.jwt()) ->> 'sub')
  );

create policy "Users can upload their own resume objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = ((select auth.jwt()) ->> 'sub')
  );

create policy "Users can update their own resume objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = ((select auth.jwt()) ->> 'sub')
  )
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = ((select auth.jwt()) ->> 'sub')
  );

create policy "Users can delete their own resume objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = ((select auth.jwt()) ->> 'sub')
  );

create or replace function public.touch_resume_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.touch_resume_updated_at() from public, anon, authenticated;
create trigger resumes_touch_updated_at
  before update on public.resumes
  for each row execute function public.touch_resume_updated_at();
create trigger resume_profiles_touch_updated_at
  before update on public.resume_profiles
  for each row execute function public.touch_resume_updated_at();
