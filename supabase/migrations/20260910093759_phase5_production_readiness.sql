-- Phase 5 production-readiness foundation.
-- Account deletion jobs intentionally live outside public.profile cascades so
-- cleanup can be retried after the applicant records have been removed.

create schema if not exists private;

alter table public.profiles
  add column onboarding_completed_at timestamptz,
  add column raw_file_retention_policy text not null default 'delete_after_approval',
  add column deletion_requested_at timestamptz,
  add column deletion_status text not null default 'active';

alter table public.profiles
  add constraint profiles_raw_file_retention_policy_check
    check (raw_file_retention_policy in ('delete_after_approval', 'retain_30_days')),
  add constraint profiles_deletion_status_check
    check (deletion_status in ('active', 'pending', 'processing', 'failed'));

alter table public.resumes
  add column raw_file_delete_after timestamptz,
  add column raw_file_deleted_at timestamptz;

alter table public.resume_processing_jobs
  add column estimated_cost_microusd bigint
    check (estimated_cost_microusd is null or estimated_cost_microusd >= 0);
alter table public.embedding_jobs
  add column estimated_cost_microusd bigint
    check (estimated_cost_microusd is null or estimated_cost_microusd >= 0);
alter table public.resume_embeddings
  add column estimated_cost_microusd bigint
    check (estimated_cost_microusd is null or estimated_cost_microusd >= 0);
alter table public.job_posting_embeddings
  add column estimated_cost_microusd bigint
    check (estimated_cost_microusd is null or estimated_cost_microusd >= 0);
alter table public.job_match_explanations
  add column estimated_cost_microusd bigint
    check (estimated_cost_microusd is null or estimated_cost_microusd >= 0);

create index profiles_deletion_status_idx
  on public.profiles (deletion_status, deletion_requested_at)
  where deletion_status <> 'active';

create index resumes_raw_file_retention_idx
  on public.resumes (raw_file_delete_after)
  where raw_file_delete_after is not null and raw_file_deleted_at is null;

create table public.account_deletion_jobs (
  user_id text primary key,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'complete', 'failed')),
  source text not null check (source in ('application', 'clerk_webhook')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 5),
  requested_at timestamptz not null default timezone('utc', now()),
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  storage_deleted_at timestamptz,
  data_deleted_at timestamptz,
  clerk_user_deleted_at timestamptz,
  completed_at timestamptz,
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 80),
  updated_at timestamptz not null default timezone('utc', now())
);

create index account_deletion_jobs_due_idx
  on public.account_deletion_jobs (status, available_at, requested_at)
  where status in ('pending', 'failed', 'processing');

alter table public.account_deletion_jobs enable row level security;
revoke all on table public.account_deletion_jobs from public, anon, authenticated;
grant select, insert, update, delete on table public.account_deletion_jobs to service_role;

create policy "Trusted workers manage account deletion jobs"
  on public.account_deletion_jobs for all to service_role
  using (true)
  with check (true);

create or replace function private.reject_deleted_account_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.profiles
    where user_id = new.user_id
      and deletion_requested_at is not null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'account_deletion_in_progress';
  end if;
  return new;
end;
$$;

revoke all on function private.reject_deleted_account_write() from public, anon, authenticated;

create trigger resumes_reject_deleted_account_write
  before insert or update on public.resumes
  for each row execute function private.reject_deleted_account_write();
create trigger resume_profiles_reject_deleted_account_write
  before insert or update on public.resume_profiles
  for each row execute function private.reject_deleted_account_write();
create trigger resume_processing_jobs_reject_deleted_account_write
  before insert or update on public.resume_processing_jobs
  for each row execute function private.reject_deleted_account_write();
create trigger candidate_preferences_reject_deleted_account_write
  before insert or update on public.candidate_preferences
  for each row execute function private.reject_deleted_account_write();
create trigger resume_embeddings_reject_deleted_account_write
  before insert or update on public.resume_embeddings
  for each row execute function private.reject_deleted_account_write();
create trigger match_runs_reject_deleted_account_write
  before insert or update on public.match_runs
  for each row execute function private.reject_deleted_account_write();
create trigger job_matches_reject_deleted_account_write
  before insert or update on public.job_matches
  for each row execute function private.reject_deleted_account_write();
create trigger job_match_explanations_reject_deleted_account_write
  before insert or update on public.job_match_explanations
  for each row execute function private.reject_deleted_account_write();
create trigger job_actions_reject_deleted_account_write
  before insert or update on public.job_actions
  for each row execute function private.reject_deleted_account_write();
create trigger job_feedback_reject_deleted_account_write
  before insert or update on public.job_feedback
  for each row execute function private.reject_deleted_account_write();

create or replace function private.touch_account_deletion_job()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function private.touch_account_deletion_job() from public, anon, authenticated;
create trigger account_deletion_jobs_touch_updated_at
  before update on public.account_deletion_jobs
  for each row execute function private.touch_account_deletion_job();

create or replace function public.get_resulens_operational_snapshot(
  p_stalled_before timestamptz,
  p_stale_source_before timestamptz,
  p_usage_since timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'failedResumes', (
      select count(*) from public.resumes where status in ('failed', 'delete_failed')
    ),
    'stalledResumes', (
      select count(*) from public.resume_processing_jobs
      where status = 'processing' and locked_at < p_stalled_before
    ),
    'failedEmbeddings', (
      select count(*) from public.embedding_jobs where status = 'failed'
    ),
    'staleSources', (
      select count(*) from public.job_sources
      where status = 'active'
        and (last_succeeded_at is null or last_succeeded_at < p_stale_source_before)
    ),
    'incompleteAccountDeletions', (
      select count(*) from public.account_deletion_jobs
      where status in ('pending', 'failed', 'processing')
    ),
    'estimatedAiSpendMicrousd24h',
      coalesce((select sum(estimated_cost_microusd) from public.resume_processing_jobs where created_at >= p_usage_since), 0)
      + coalesce((select sum(estimated_cost_microusd) from public.resume_embeddings where created_at >= p_usage_since), 0)
      + coalesce((select sum(estimated_cost_microusd) from public.job_posting_embeddings where created_at >= p_usage_since), 0)
      + coalesce((select sum(estimated_cost_microusd) from public.job_match_explanations where created_at >= p_usage_since), 0)
  );
$$;

revoke all on function public.get_resulens_operational_snapshot(timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_resulens_operational_snapshot(timestamptz, timestamptz, timestamptz)
  to service_role;

-- Recovery note: the migration is additive. If application rollback is
-- required, leave the columns/table in place and stop invoking Phase 5 routes;
-- dropping deletion state while jobs are pending would make cleanup unsafe.
