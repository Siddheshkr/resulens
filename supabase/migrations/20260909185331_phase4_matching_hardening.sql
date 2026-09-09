-- Phase 4 hardening: make worker-only boundaries explicit to the linter and
-- cover composite foreign keys used by deletion/status checks.

create index if not exists embedding_jobs_resume_owner_idx
  on public.embedding_jobs (resume_id, user_id);
create index if not exists embedding_jobs_user_idx
  on public.embedding_jobs (user_id);
create index if not exists embedding_jobs_job_idx
  on public.embedding_jobs (job_posting_id);
create index if not exists resume_embeddings_resume_owner_idx
  on public.resume_embeddings (resume_id, user_id);
create index if not exists match_runs_resume_owner_idx
  on public.match_runs (resume_id, user_id);
create index if not exists job_match_explanations_match_run_idx
  on public.job_match_explanations (match_run_id);
create index if not exists job_match_explanations_job_idx
  on public.job_match_explanations (job_posting_id);
create index if not exists job_actions_job_idx
  on public.job_actions (job_posting_id);
create index if not exists job_actions_match_run_idx
  on public.job_actions (match_run_id);
create index if not exists job_feedback_job_idx
  on public.job_feedback (job_posting_id);
create index if not exists job_feedback_match_run_idx
  on public.job_feedback (match_run_id);
create unique index if not exists match_runs_pending_unique_idx
  on public.match_runs (user_id, resume_id, resume_profile_version, preferences_revision, scoring_version)
  where status = 'embedding_pending';

create policy "No direct resume embedding access"
  on public.resume_embeddings for all to anon, authenticated
  using (false) with check (false);
create policy "No direct job embedding access"
  on public.job_posting_embeddings for all to anon, authenticated
  using (false) with check (false);
create policy "No direct embedding queue access"
  on public.embedding_jobs for all to anon, authenticated
  using (false) with check (false);
