-- Phase 3 job ingestion foundation.
-- Provider payloads are kept in the private schema. The public normalized
-- tables contain only fields needed by the product and authenticated readers.

create schema if not exists private;

create table public.job_sources (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('adzuna', 'greenhouse', 'lever')),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{1,95}$'),
  display_name text not null check (char_length(display_name) between 1 and 120),
  status text not null default 'active' check (status in ('active', 'paused', 'error')),
  provider_config jsonb not null default '{}'::jsonb,
  refresh_interval_minutes integer not null default 360
    check (refresh_interval_minutes between 60 and 1440),
  last_attempted_at timestamptz,
  last_succeeded_at timestamptz,
  last_error_code text,
  last_error_message text check (
    last_error_message is null or char_length(last_error_message) <= 500
  ),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index job_sources_status_idx on public.job_sources (status, last_succeeded_at);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  normalized_name text not null unique check (char_length(normalized_name) between 1 and 200),
  display_name text not null check (char_length(display_name) between 1 and 200),
  website_url text check (website_url is null or website_url ~ '^https://'),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.job_sources(id) on delete restrict,
  external_job_id text not null check (char_length(external_job_id) between 1 and 200),
  company_id uuid references public.companies(id) on delete set null,
  title text not null check (char_length(title) between 1 and 300),
  description text not null check (char_length(description) between 1 and 250000),
  location_text text check (location_text is null or char_length(location_text) <= 500),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  workplace_type text not null default 'unknown'
    check (workplace_type in ('onsite', 'hybrid', 'remote', 'unknown')),
  employment_type text check (employment_type is null or char_length(employment_type) <= 80),
  seniority text check (seniority is null or char_length(seniority) <= 80),
  canonical_url text not null check (canonical_url ~ '^https://'),
  source_updated_at timestamptz,
  posted_at timestamptz,
  expires_at timestamptz,
  status text not null default 'active' check (status in ('active', 'closed', 'expired')),
  content_fingerprint text not null check (content_fingerprint ~ '^[a-f0-9]{64}$'),
  last_seen_at timestamptz not null default timezone('utc', now()),
  search_document tsvector generated always as (
    to_tsvector(
      'simple'::regconfig,
      coalesce(title, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(location_text, '')
    )
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_id, external_job_id)
);

create index job_postings_source_external_idx on public.job_postings (source_id, external_job_id);
create index job_postings_status_posted_idx on public.job_postings (status, posted_at desc);
create index job_postings_filter_idx
  on public.job_postings (country_code, workplace_type, seniority, posted_at desc)
  where status = 'active';
create index job_postings_company_idx on public.job_postings (company_id);
create index job_postings_fingerprint_idx on public.job_postings (content_fingerprint);
create index job_postings_search_idx on public.job_postings using gin (search_document);

create table public.job_skills (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  normalized_skill text not null check (char_length(normalized_skill) between 1 and 120),
  display_skill text not null check (char_length(display_skill) between 1 and 160),
  source text not null default 'provider' check (source in ('provider', 'extracted')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (job_posting_id, normalized_skill)
);

create index job_skills_lookup_idx on public.job_skills (normalized_skill, job_posting_id);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.job_sources(id) on delete restrict,
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  pages_fetched integer not null default 0 check (pages_fetched >= 0),
  records_seen integer not null default 0 check (records_seen >= 0),
  records_upserted integer not null default 0 check (records_upserted >= 0),
  records_failed integer not null default 0 check (records_failed >= 0),
  retry_count integer not null default 0 check (retry_count between 0 and 5),
  rate_limit_count integer not null default 0 check (rate_limit_count >= 0),
  is_complete boolean not null default false,
  error_code text,
  error_message text check (error_message is null or char_length(error_message) <= 500),
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index ingestion_runs_source_started_idx
  on public.ingestion_runs (source_id, started_at desc);
create index ingestion_runs_status_idx on public.ingestion_runs (status, started_at);

-- Provider payloads can contain arbitrary fields and are never exposed through
-- the Data API. Only trusted workers receive access to this schema.
create table private.job_posting_payloads (
  job_posting_id uuid primary key references public.job_postings(id) on delete cascade,
  source_id uuid not null references public.job_sources(id) on delete restrict,
  payload jsonb not null,
  content_fingerprint text not null check (content_fingerprint ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz not null default timezone('utc', now())
);

alter table public.job_sources enable row level security;
alter table public.companies enable row level security;
alter table public.job_postings enable row level security;
alter table public.job_skills enable row level security;
alter table public.ingestion_runs enable row level security;
alter table private.job_posting_payloads enable row level security;

revoke all on table public.job_sources, public.companies, public.job_postings,
  public.job_skills, public.ingestion_runs from anon, authenticated;
grant select on table public.companies, public.job_postings, public.job_skills to authenticated;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on table private.job_posting_payloads to service_role;
grant select, insert, update, delete on table public.job_sources to service_role;
grant select, insert, update, delete on table public.companies to service_role;
grant select, insert, update, delete on table public.job_postings to service_role;
grant select, insert, update, delete on table public.job_skills to service_role;
grant select, insert, update, delete on table public.ingestion_runs to service_role;

create policy "Authenticated users can view companies"
  on public.companies for select to authenticated
  using (true);

create policy "Authenticated users can view current jobs"
  on public.job_postings for select to authenticated
  using (status in ('active', 'closed'));

create policy "Authenticated users can view job skills"
  on public.job_skills for select to authenticated
  using (exists (
    select 1 from public.job_postings
    where public.job_postings.id = job_posting_id
      and public.job_postings.status in ('active', 'closed')
  ));

create or replace function public.touch_job_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

revoke all on function public.touch_job_updated_at() from public, anon, authenticated;
create trigger job_sources_touch_updated_at
  before update on public.job_sources
  for each row execute function public.touch_job_updated_at();
create trigger companies_touch_updated_at
  before update on public.companies
  for each row execute function public.touch_job_updated_at();
create trigger job_postings_touch_updated_at
  before update on public.job_postings
  for each row execute function public.touch_job_updated_at();

comment on table public.job_sources is
  'Service-managed provider configurations. Secrets stay in server environment variables.';
comment on table public.job_postings is
  'Normalized public job metadata. Provider payloads are stored in private.job_posting_payloads.';
comment on column public.job_postings.search_document is
  'Simple-language full-text document used for lexical search; embeddings arrive in a later phase.';

