begin;

select plan(12);

set local role service_role;

insert into public.job_sources (id, provider, slug, display_name, provider_config)
values (
  '00000000-0000-0000-0000-000000000101',
  'greenhouse',
  'synthetic-board',
  'Synthetic board',
  '{"boardToken":"synthetic"}'::jsonb
);

insert into public.companies (id, normalized_name, display_name)
values ('00000000-0000-0000-0000-000000000102', 'synthetic labs', 'Synthetic Labs');

insert into public.job_postings (
  id, source_id, external_job_id, company_id, title, description, location_text,
  country_code, workplace_type, canonical_url, content_fingerprint, cross_posting_key, status
)
values
(
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000101',
  'job-active',
  '00000000-0000-0000-0000-000000000102',
  'Synthetic Platform Engineer',
  'Build resilient synthetic services.',
  'Remote - India',
  'IN',
  'remote',
  'https://example.com/jobs/job-active',
  repeat('a', 64),
  repeat('1', 64),
  'active'
),
(
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000101',
  'job-expired',
  '00000000-0000-0000-0000-000000000102',
  'Expired role',
  'No longer available.',
  'Delhi',
  'IN',
  'onsite',
  'https://example.com/jobs/job-expired',
  repeat('b', 64),
  repeat('2', 64),
  'expired'
);

insert into public.job_skills (job_posting_id, normalized_skill, display_skill)
values ('00000000-0000-0000-0000-000000000103', 'typescript', 'TypeScript');

insert into private.job_posting_payloads (
  job_posting_id, source_id, payload, content_fingerprint
)
values (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000101',
  '{"title":"Synthetic Platform Engineer"}'::jsonb,
  repeat('a', 64)
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_a","role":"authenticated"}', true);

select is(
  (select count(*)::integer from public.job_postings),
  1,
  'authenticated users can view active jobs'
);

select is(
  (select count(*)::integer from public.companies),
  1,
  'authenticated users can view normalized companies'
);

select is(
  (select count(display_name)::integer from public.job_sources),
  1,
  'authenticated users can view safe source attribution'
);

select throws_ok(
  $$select provider_config from public.job_sources$$,
  '42501',
  null,
  'authenticated users cannot read provider configuration'
);

select is(
  (select count(*)::integer from public.job_skills),
  1,
  'authenticated users can view skills for current jobs'
);

select throws_ok(
  $$insert into public.job_sources (provider, slug, display_name) values ('lever', 'forbidden', 'Forbidden')$$,
  '42501',
  null,
  'authenticated users cannot create provider sources'
);

select throws_ok(
  $$update public.job_postings set title = 'Tampered' where id = '00000000-0000-0000-0000-000000000103'$$,
  '42501',
  null,
  'authenticated users cannot modify normalized jobs'
);

select throws_ok(
  $$delete from public.job_postings where id = '00000000-0000-0000-0000-000000000103'$$,
  '42501',
  null,
  'authenticated users cannot delete normalized jobs'
);

select throws_ok(
  $$select count(*) from private.job_posting_payloads$$,
  '42501',
  null,
  'authenticated users cannot read raw provider payloads'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  $$select count(*) from public.job_postings$$,
  '42501',
  null,
  'anonymous callers cannot read jobs'
);

select throws_ok(
  $$select count(*) from public.companies$$,
  '42501',
  null,
  'anonymous callers cannot read companies'
);

select throws_ok(
  $$select count(*) from public.job_skills$$,
  '42501',
  null,
  'anonymous callers cannot read skills'
);

select finish();
rollback;
