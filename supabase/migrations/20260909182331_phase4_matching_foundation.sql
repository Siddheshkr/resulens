-- Phase 4 matching foundation.
-- Embeddings and scoring evidence are derived data. Resume vectors never leave
-- the worker boundary, while match rows and user actions are owned by Clerk's
-- immutable subject claim.

create extension if not exists vector with schema extensions;

do $$
begin
  perform pgmq.create('embedding_processing');
exception
  when duplicate_object then null;
end;
$$;

alter table public.job_postings
  add column if not exists salary_min numeric(12, 2),
  add column if not exists salary_max numeric(12, 2),
  add column if not exists salary_currency text,
  add column if not exists work_authorization_support text not null default 'unknown',
  add column if not exists required_experience_min_years numeric(4, 1),
  add column if not exists required_experience_max_years numeric(4, 1);

alter table public.job_postings
  add constraint job_postings_salary_range_check
  check (
    (salary_min is null or salary_min >= 0)
    and (salary_max is null or salary_max >= 0)
    and (salary_min is null or salary_max is null or salary_max >= salary_min)
  );

alter table public.job_postings
  add constraint job_postings_salary_currency_check
  check (salary_currency is null or salary_currency ~ '^[A-Z]{3}$');

alter table public.job_postings
  add constraint job_postings_work_authorization_check
  check (work_authorization_support in ('sponsors', 'no_sponsorship', 'unknown'));

alter table public.job_postings
  add constraint job_postings_experience_range_check
  check (
    (required_experience_min_years is null or required_experience_min_years >= 0)
    and (required_experience_max_years is null or required_experience_max_years >= 0)
    and (
      required_experience_min_years is null
      or required_experience_max_years is null
      or required_experience_max_years >= required_experience_min_years
    )
  );

create table public.candidate_preferences (
  user_id text primary key references public.profiles(user_id) on delete cascade,
  revision integer not null default 1 check (revision > 0),
  country_codes text[] not null default array['IN']::text[],
  preferred_locations text[] not null default '{}'::text[],
  workplace_types text[] not null default '{}'::text[],
  role_exclusions text[] not null default '{}'::text[],
  minimum_experience_years numeric(4, 1),
  maximum_experience_years numeric(4, 1),
  salary_minimum numeric(12, 2),
  salary_currency text,
  work_authorization_status text not null default 'unknown'
    check (work_authorization_status in ('authorized', 'needs_sponsorship', 'unknown')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (minimum_experience_years is null or minimum_experience_years >= 0)
    and (maximum_experience_years is null or maximum_experience_years >= 0)
    and (
      minimum_experience_years is null
      or maximum_experience_years is null
      or maximum_experience_years >= minimum_experience_years
    )
  ),
  check (salary_minimum is null or salary_minimum >= 0),
  check (salary_currency is null or salary_currency ~ '^[A-Z]{3}$')
);

create index candidate_preferences_country_idx
  on public.candidate_preferences using gin (country_codes);
create index candidate_preferences_workplace_idx
  on public.candidate_preferences using gin (workplace_types);

create table public.resume_embeddings (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null,
  user_id text not null references public.profiles(user_id) on delete cascade,
  profile_version integer not null check (profile_version > 0),
  model text not null check (char_length(model) between 1 and 120),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  embedding extensions.vector(1536) not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (resume_id, profile_version, model, content_hash),
  foreign key (resume_id, user_id) references public.resumes(id, user_id) on delete cascade
);

create index resume_embeddings_owner_idx
  on public.resume_embeddings (user_id, resume_id, profile_version desc);

create table public.job_posting_embeddings (
  job_posting_id uuid primary key references public.job_postings(id) on delete cascade,
  model text not null check (char_length(model) between 1 and 120),
  content_fingerprint text not null check (content_fingerprint ~ '^[a-f0-9]{64}$'),
  embedding extensions.vector(1536) not null,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index job_posting_embeddings_vector_idx
  on public.job_posting_embeddings
  using hnsw (embedding extensions.vector_cosine_ops);

create index job_posting_embeddings_fingerprint_idx
  on public.job_posting_embeddings (content_fingerprint, model);

create table public.embedding_jobs (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('resume', 'job')),
  resume_id uuid,
  job_posting_id uuid,
  user_id text references public.profiles(user_id) on delete cascade,
  source_version text not null check (char_length(source_version) between 1 and 160),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'succeeded', 'failed')),
  attempt_count smallint not null default 0 check (attempt_count between 0 and 3),
  available_at timestamptz not null default timezone('utc', now()),
  locked_at timestamptz,
  locked_by text,
  last_error_code text,
  last_error_message text check (last_error_message is null or char_length(last_error_message) <= 500),
  provider_model text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  check (
    (subject_type = 'resume' and resume_id is not null and job_posting_id is null and user_id is not null)
    or (subject_type = 'job' and resume_id is null and job_posting_id is not null and user_id is null)
  ),
  foreign key (resume_id, user_id) references public.resumes(id, user_id) on delete cascade,
  foreign key (job_posting_id) references public.job_postings(id) on delete cascade
);

create unique index embedding_jobs_active_resume_idx
  on public.embedding_jobs (resume_id, source_version)
  where subject_type = 'resume' and status in ('queued', 'processing');
create unique index embedding_jobs_active_job_idx
  on public.embedding_jobs (job_posting_id, source_version)
  where subject_type = 'job' and status in ('queued', 'processing');
create index embedding_jobs_queue_idx
  on public.embedding_jobs (status, available_at, created_at);

create table public.match_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(user_id) on delete cascade,
  resume_id uuid not null,
  resume_profile_version integer not null check (resume_profile_version > 0),
  preferences_revision integer not null check (preferences_revision > 0),
  scoring_version text not null check (char_length(scoring_version) between 1 and 120),
  embedding_model text not null check (char_length(embedding_model) between 1 and 120),
  source_snapshot_hash text not null check (source_snapshot_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'running'
    check (status in ('embedding_pending', 'running', 'succeeded', 'partial', 'failed')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  explanation_status text not null default 'pending'
    check (explanation_status in ('pending', 'processing', 'complete', 'partial', 'failed')),
  filter_snapshot jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  foreign key (resume_id, user_id) references public.resumes(id, user_id) on delete cascade
);

create index match_runs_owner_idx on public.match_runs (user_id, created_at desc);
create index match_runs_resume_version_idx
  on public.match_runs (resume_id, resume_profile_version, preferences_revision, created_at desc);

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  match_run_id uuid not null references public.match_runs(id) on delete cascade,
  user_id text not null references public.profiles(user_id) on delete cascade,
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  rank integer not null check (rank > 0),
  match_score numeric(6, 5) not null check (match_score between 0 and 1),
  lexical_score numeric(6, 5) check (lexical_score is null or lexical_score between 0 and 1),
  semantic_score numeric(6, 5) check (semantic_score is null or semantic_score between 0 and 1),
  score_breakdown jsonb not null,
  eligibility jsonb not null,
  evidence jsonb not null default '{}'::jsonb,
  job_content_fingerprint text not null check (job_content_fingerprint ~ '^[a-f0-9]{64}$'),
  embedding_model text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (match_run_id, job_posting_id),
  unique (match_run_id, rank)
);

create index job_matches_owner_idx on public.job_matches (user_id, created_at desc);
create index job_matches_run_rank_idx on public.job_matches (match_run_id, rank);
create index job_matches_job_idx on public.job_matches (job_posting_id, created_at desc);

create table public.job_match_explanations (
  id uuid primary key default gen_random_uuid(),
  job_match_id uuid not null references public.job_matches(id) on delete cascade,
  match_run_id uuid not null references public.match_runs(id) on delete cascade,
  user_id text not null references public.profiles(user_id) on delete cascade,
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('pending', 'succeeded', 'failed')),
  model text,
  prompt_version text not null,
  explanation jsonb,
  error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 500),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (job_match_id, input_hash)
);

create index job_match_explanations_owner_idx
  on public.job_match_explanations (user_id, match_run_id, created_at desc);

create table public.job_actions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(user_id) on delete cascade,
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  state text not null check (state in ('saved', 'dismissed', 'applied')),
  match_run_id uuid references public.match_runs(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, job_posting_id)
);

create index job_actions_owner_state_idx on public.job_actions (user_id, state, updated_at desc);

create table public.job_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.profiles(user_id) on delete cascade,
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  match_run_id uuid references public.match_runs(id) on delete set null,
  label text not null check (label in ('relevant', 'not_relevant')),
  note text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, job_posting_id)
);

create index job_feedback_owner_idx on public.job_feedback (user_id, updated_at desc);

alter table public.candidate_preferences enable row level security;
alter table public.resume_embeddings enable row level security;
alter table public.job_posting_embeddings enable row level security;
alter table public.embedding_jobs enable row level security;
alter table public.match_runs enable row level security;
alter table public.job_matches enable row level security;
alter table public.job_match_explanations enable row level security;
alter table public.job_actions enable row level security;
alter table public.job_feedback enable row level security;

revoke all on table public.candidate_preferences, public.resume_embeddings,
  public.job_posting_embeddings, public.embedding_jobs, public.match_runs,
  public.job_matches, public.job_match_explanations, public.job_actions,
  public.job_feedback from anon, authenticated;

grant select, insert, update, delete on table public.candidate_preferences to authenticated;
grant select on table public.match_runs, public.job_matches, public.job_match_explanations to authenticated;
grant select, insert, update, delete on table public.job_actions to authenticated;
grant select, insert, update, delete on table public.job_feedback to authenticated;

grant select, insert, update, delete on table public.resume_embeddings,
  public.job_posting_embeddings, public.embedding_jobs, public.match_runs,
  public.job_matches, public.job_match_explanations to service_role;

create policy "Users can view their preferences"
  on public.candidate_preferences for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can create their preferences"
  on public.candidate_preferences for insert to authenticated
  with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can update their preferences"
  on public.candidate_preferences for update to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can delete their preferences"
  on public.candidate_preferences for delete to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can view their match runs"
  on public.match_runs for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can view their job matches"
  on public.job_matches for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can view their explanations"
  on public.job_match_explanations for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can view their job actions"
  on public.job_actions for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can create their job actions"
  on public.job_actions for insert to authenticated
  with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can update their job actions"
  on public.job_actions for update to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can delete their job actions"
  on public.job_actions for delete to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create policy "Users can view their feedback"
  on public.job_feedback for select to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can create their feedback"
  on public.job_feedback for insert to authenticated
  with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can update their feedback"
  on public.job_feedback for update to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id)
  with check (((select auth.jwt()) ->> 'sub') = user_id);
create policy "Users can delete their feedback"
  on public.job_feedback for delete to authenticated
  using (((select auth.jwt()) ->> 'sub') = user_id);

create or replace function public.touch_matching_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.bump_preferences_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.revision <= old.revision then
    new.revision = old.revision + 1;
  end if;
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.touch_matching_updated_at() from public, anon, authenticated;
revoke all on function public.bump_preferences_revision() from public, anon, authenticated;

create trigger candidate_preferences_touch_updated_at
  before update on public.candidate_preferences
  for each row execute function public.bump_preferences_revision();
create trigger resume_embeddings_touch_updated_at
  before update on public.resume_embeddings
  for each row execute function public.touch_matching_updated_at();
create trigger job_posting_embeddings_touch_updated_at
  before update on public.job_posting_embeddings
  for each row execute function public.touch_matching_updated_at();
create trigger job_match_explanations_touch_updated_at
  before update on public.job_match_explanations
  for each row execute function public.touch_matching_updated_at();
create trigger job_actions_touch_updated_at
  before update on public.job_actions
  for each row execute function public.touch_matching_updated_at();
create trigger job_feedback_touch_updated_at
  before update on public.job_feedback
  for each row execute function public.touch_matching_updated_at();

create or replace function public.enqueue_embedding_processing(
  p_embedding_job_id uuid,
  p_delay_seconds integer default 0
)
returns bigint
language sql
security definer
set search_path = pgmq, pg_catalog
as $$
  select pgmq.send(
    'embedding_processing',
    jsonb_build_object('embedding_job_id', p_embedding_job_id),
    greatest(0, least(coalesce(p_delay_seconds, 0), 86400))
  )
  limit 1;
$$;

create or replace function public.read_embedding_processing(
  p_visibility_timeout integer default 300,
  p_limit integer default 5
)
returns jsonb
language sql
security definer
set search_path = pgmq, pg_catalog
as $$
  select coalesce(jsonb_agg(to_jsonb(message_row)), '[]'::jsonb)
  from pgmq.read(
    'embedding_processing',
    greatest(30, least(coalesce(p_visibility_timeout, 300), 900)),
    greatest(1, least(coalesce(p_limit, 5), 5))
  ) as message_row;
$$;

create or replace function public.ack_embedding_processing(p_message_id bigint)
returns boolean
language sql
security definer
set search_path = pgmq, pg_catalog
as $$
  select pgmq.delete('embedding_processing', p_message_id);
$$;

revoke all on function public.enqueue_embedding_processing(uuid, integer) from public, anon, authenticated;
revoke all on function public.read_embedding_processing(integer, integer) from public, anon, authenticated;
revoke all on function public.ack_embedding_processing(bigint) from public, anon, authenticated;
grant execute on function public.enqueue_embedding_processing(uuid, integer) to service_role;
grant execute on function public.read_embedding_processing(integer, integer) to service_role;
grant execute on function public.ack_embedding_processing(bigint) to service_role;

create or replace function public.search_job_candidates(
  p_resume_embedding extensions.vector(1536) default null,
  p_query text default null,
  p_country_codes text[] default '{}'::text[],
  p_workplace_types text[] default '{}'::text[],
  p_role_exclusions text[] default '{}'::text[],
  p_limit integer default 100
)
returns table (
  job_posting_id uuid,
  lexical_score real,
  semantic_score real,
  retrieval_source text
)
language sql
stable
set search_path = public, extensions, pg_catalog
as $$
  with eligible as (
    select j.*
    from public.job_postings j
    where j.status = 'active'
      and (
        cardinality(coalesce(p_country_codes, '{}'::text[])) = 0
        or j.country_code = any(p_country_codes)
      )
      and (
        cardinality(coalesce(p_workplace_types, '{}'::text[])) = 0
        or j.workplace_type = any(p_workplace_types)
      )
      and not exists (
        select 1
        from unnest(coalesce(p_role_exclusions, '{}'::text[])) as exclusion(term)
        where lower(j.title || ' ' || j.description) like '%' || lower(exclusion.term) || '%'
      )
  ),
  lexical as (
    select
      e.id as job_posting_id,
      least(
        1::real,
        greatest(
          0::real,
          ts_rank_cd(
            e.search_document,
            websearch_to_tsquery('simple', nullif(trim(p_query), ''))
          )
        )
      ) as lexical_score
    from eligible e
    where nullif(trim(p_query), '') is not null
      and e.search_document @@ websearch_to_tsquery('simple', trim(p_query))
    order by lexical_score desc, e.posted_at desc nulls last, e.id
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ),
  semantic as (
    select
      e.job_posting_id,
      least(
        1::real,
        greatest(0::real, (1 - (e.embedding <=> p_resume_embedding))::real)
      ) as semantic_score
    from public.job_posting_embeddings e
    join eligible j on j.id = e.job_posting_id
    where p_resume_embedding is not null
    order by e.embedding <=> p_resume_embedding
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ),
  combined as (
    select l.job_posting_id, l.lexical_score, null::real as semantic_score
    from lexical l
    union all
    select s.job_posting_id, null::real as lexical_score, s.semantic_score
    from semantic s
  )
  select
    c.job_posting_id,
    max(c.lexical_score) as lexical_score,
    max(c.semantic_score) as semantic_score,
    case
      when max(c.lexical_score) is not null and max(c.semantic_score) is not null then 'hybrid'
      when max(c.semantic_score) is not null then 'vector'
      else 'full_text'
    end as retrieval_source
  from combined c
  group by c.job_posting_id
  order by greatest(coalesce(max(c.lexical_score), 0), coalesce(max(c.semantic_score), 0)) desc,
    c.job_posting_id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.search_job_candidates(
  extensions.vector(1536), text, text[], text[], text[], integer
) from public, anon, authenticated;
grant execute on function public.search_job_candidates(
  extensions.vector(1536), text, text[], text[], text[], integer
) to service_role;

comment on table public.resume_embeddings is
  'Private professional-content embeddings keyed to an approved resume profile revision.';
comment on table public.job_posting_embeddings is
  'Service-managed job embeddings keyed to normalized posting content fingerprints.';
comment on table public.match_runs is
  'Versioned deterministic ranking runs. Scores are ResuLens product rankings, not hiring decisions.';
comment on function public.search_job_candidates(extensions.vector(1536), text, text[], text[], text[], integer) is
  'Service-only union of hard-filtered full-text and vector candidate retrieval.';
