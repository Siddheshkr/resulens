begin;

select plan(20);

set local role service_role;

insert into public.profiles (user_id) values ('user_a'), ('user_b');

insert into public.resumes (
  id, user_id, original_filename, storage_path, byte_size, status,
  processing_stage, approved_profile_version, ai_processing_consent_at
)
values (
  '00000000-0000-0000-0000-000000000201', 'user_a', 'synthetic.pdf',
  'user_a/00000000-0000-0000-0000-000000000201.pdf', 1024, 'approved',
  'approved', 1, timezone('utc', now())
);

insert into public.resume_profiles (
  resume_id, user_id, version, status, profile, schema_version, prompt_version, source_mode
)
values (
  '00000000-0000-0000-0000-000000000201', 'user_a', 1, 'approved',
  '{}'::jsonb, 'test', 'test', 'manual'
);

insert into public.job_sources (id, provider, slug, display_name, provider_config)
values (
  '00000000-0000-0000-0000-000000000202', 'greenhouse', 'matching-synthetic',
  'Matching synthetic source', '{}'::jsonb
);

insert into public.companies (id, normalized_name, display_name)
values ('00000000-0000-0000-0000-000000000203', 'matching synthetic labs', 'Matching Synthetic Labs');

insert into public.job_postings (
  id, source_id, external_job_id, company_id, title, description, location_text,
  country_code, workplace_type, canonical_url, content_fingerprint, cross_posting_key, status
)
values (
  '00000000-0000-0000-0000-000000000204',
  '00000000-0000-0000-0000-000000000202', 'matching-job',
  '00000000-0000-0000-0000-000000000203', 'Synthetic Platform Engineer',
  'Build synthetic services.', 'Remote - India', 'IN', 'remote',
  'https://example.com/matching-job', repeat('d', 64), repeat('3', 64), 'active'
);

insert into public.candidate_preferences (user_id)
values ('user_a');

insert into public.embedding_jobs (id, subject_type, job_posting_id, source_version)
values (
  '00000000-0000-0000-0000-000000000205', 'job',
  '00000000-0000-0000-0000-000000000204', 'synthetic-source'
);

insert into public.match_runs (
  id, user_id, resume_id, resume_profile_version, preferences_revision,
  scoring_version, embedding_model, source_snapshot_hash, status, candidate_count
)
values (
  '00000000-0000-0000-0000-000000000206', 'user_a',
  '00000000-0000-0000-0000-000000000201', 1, 1,
  'synthetic-v1', 'text-embedding-3-small', repeat('e', 64), 'succeeded', 1
);

insert into public.job_matches (
  id, match_run_id, user_id, job_posting_id, rank, match_score,
  score_breakdown, eligibility, evidence, job_content_fingerprint
)
values (
  '00000000-0000-0000-0000-000000000207',
  '00000000-0000-0000-0000-000000000206', 'user_a',
  '00000000-0000-0000-0000-000000000204', 1, 0.8,
  '{"score":0.8}'::jsonb, '{"status":"eligible"}'::jsonb, '{}'::jsonb, repeat('d', 64)
);

insert into public.job_match_explanations (
  id, job_match_id, match_run_id, user_id, job_posting_id, input_hash,
  status, prompt_version, explanation
)
values (
  '00000000-0000-0000-0000-000000000208',
  '00000000-0000-0000-0000-000000000207',
  '00000000-0000-0000-0000-000000000206', 'user_a',
  '00000000-0000-0000-0000-000000000204', repeat('f', 64),
  'succeeded', 'synthetic-v1', '{"summary":"Synthetic evidence"}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_a","role":"authenticated"}', true);

select is((select count(*)::integer from public.candidate_preferences), 1,
  'a user can read their own matching preferences');
select lives_ok(
  $$update public.candidate_preferences set workplace_types = array['remote'] where user_id = 'user_a'$$,
  'a user can update their own matching preferences'
);
select is((select count(*)::integer from public.match_runs), 1,
  'a user can read their own match runs');
select is((select count(*)::integer from public.job_matches), 1,
  'a user can read their own job matches');
select is((select count(*)::integer from public.job_match_explanations), 1,
  'a user can read their own explanations');
select lives_ok(
  $$insert into public.job_actions (user_id, job_posting_id, state) values ('user_a', '00000000-0000-0000-0000-000000000204', 'saved')$$,
  'a user can save a job action for themselves'
);
select lives_ok(
  $$insert into public.job_feedback (user_id, job_posting_id, label) values ('user_a', '00000000-0000-0000-0000-000000000204', 'relevant')$$,
  'a user can add feedback for themselves'
);
select throws_ok(
  $$update public.job_actions set user_id = 'user_b' where user_id = 'user_a'$$,
  '42501', null, 'a user cannot reassign job-action ownership'
);
select throws_ok(
  $$select count(*) from public.embedding_jobs$$,
  '42501', null, 'authenticated users cannot read embedding queue rows'
);
select throws_ok(
  $$select count(*) from public.resume_embeddings$$,
  '42501', null, 'authenticated users cannot read resume embeddings'
);
select throws_ok(
  $$select count(*) from public.job_posting_embeddings$$,
  '42501', null, 'authenticated users cannot read job embeddings'
);
select throws_ok(
  $$select * from public.search_job_candidates(null, 'engineer', array['IN'], array['remote'], array[]::text[], 10)$$,
  '42501', null, 'authenticated users cannot call the service-only candidate search'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user_b","role":"authenticated"}', true);

select is((select count(*)::integer from public.candidate_preferences), 0,
  'a different user cannot read matching preferences');
select is((select count(*)::integer from public.match_runs), 0,
  'a different user cannot read match runs');
select is((select count(*)::integer from public.job_matches), 0,
  'a different user cannot read job matches');
select throws_ok(
  $$insert into public.job_actions (user_id, job_posting_id, state) values ('user_a', '00000000-0000-0000-0000-000000000204', 'dismissed')$$,
  '42501', null, 'a different user cannot create an action for user_a'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select throws_ok(
  $$select count(*) from public.match_runs$$,
  '42501', null, 'anonymous callers cannot read match runs'
);
select throws_ok(
  $$select count(*) from public.candidate_preferences$$,
  '42501', null, 'anonymous callers cannot read matching preferences'
);

set local role service_role;
select throws_ok(
  $$insert into public.job_actions (user_id, job_posting_id, state, match_run_id) values ('user_b', '00000000-0000-0000-0000-000000000204', 'saved', '00000000-0000-0000-0000-000000000206')$$,
  '23503', null, 'service code cannot attach an action to another users match run'
);
select throws_ok(
  $$insert into public.job_feedback (user_id, job_posting_id, label, match_run_id) values ('user_b', '00000000-0000-0000-0000-000000000204', 'relevant', '00000000-0000-0000-0000-000000000206')$$,
  '23503', null, 'service code cannot attach feedback to another users match run'
);

select finish();
rollback;
