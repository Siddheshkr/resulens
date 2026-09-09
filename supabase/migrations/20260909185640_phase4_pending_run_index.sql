-- Prevent duplicate pending runs while an embedding worker is in flight.
create unique index if not exists match_runs_pending_unique_idx
  on public.match_runs (user_id, resume_id, resume_profile_version, preferences_revision, scoring_version)
  where status = 'embedding_pending';
