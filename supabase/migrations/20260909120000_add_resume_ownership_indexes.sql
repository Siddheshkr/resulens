-- Cover composite ownership foreign keys and the user-scoped job queue query.
-- These indexes preserve the RLS ownership boundary while avoiding table scans
-- when a resume or profile is deleted and when a worker claims a user's job.

create index if not exists resume_profiles_resume_owner_idx
  on public.resume_profiles (resume_id, user_id);

create index if not exists resume_processing_jobs_resume_owner_idx
  on public.resume_processing_jobs (resume_id, user_id);

create index if not exists resume_processing_jobs_user_created_idx
  on public.resume_processing_jobs (user_id, created_at desc);
