-- Phase completion hardening:
-- 1. Reserve account lifecycle fields and profile deletion for trusted cleanup.
-- 2. Group likely cross-provider postings without losing source-specific rows.

revoke update, delete on table public.profiles from authenticated;
grant update (raw_file_retention_policy, onboarding_completed_at)
  on table public.profiles to authenticated;

drop policy if exists "profiles_delete_own" on public.profiles;

alter table public.job_postings
  add column cross_posting_key text;

update public.job_postings as posting
set cross_posting_key = encode(
  extensions.digest(
    concat_ws(
      E'\n',
      lower(trim(regexp_replace(posting.title, '\s+', ' ', 'g'))),
      lower(trim(regexp_replace(posting.description, '\s+', ' ', 'g'))),
      lower(trim(regexp_replace(coalesce(posting.location_text, ''), '\s+', ' ', 'g'))),
      coalesce(
        (
          select company.normalized_name
          from public.companies as company
          where company.id = posting.company_id
        ),
        ''
      )
    ),
    'sha256'
  ),
  'hex'
);

alter table public.job_postings
  alter column cross_posting_key set not null,
  add constraint job_postings_cross_posting_key_format
    check (cross_posting_key ~ '^[a-f0-9]{64}$');

create index job_postings_cross_posting_idx
  on public.job_postings (cross_posting_key, status, posted_at desc);

-- Recovery: re-grant the previous table-level UPDATE/DELETE privileges and
-- recreate profiles_delete_own only if coordinated cleanup is intentionally
-- retired. Dropping cross_posting_key is safe only after reverting writers.
