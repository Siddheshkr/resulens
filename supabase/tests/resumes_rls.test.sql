begin;

select plan(11);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"user_a","role":"authenticated"}',
  true
);

insert into public.profiles (user_id) values ('user_a');
insert into public.resumes (
  id,
  user_id,
  original_filename,
  storage_path,
  byte_size,
  ai_processing_consent_at
)
values (
  '00000000-0000-0000-0000-000000000001',
  'user_a',
  'synthetic-resume.pdf',
  'user_a/00000000-0000-0000-0000-000000000001.pdf',
  1024,
  timezone('utc', now())
);

select is(
  (select count(*)::integer from public.resumes),
  1,
  'a user can see their own resume'
);

select lives_ok(
  $$insert into public.resume_profiles (resume_id, user_id, version, status, profile, schema_version, prompt_version, source_mode)
    values ('00000000-0000-0000-0000-000000000001', 'user_a', 1, 'draft', '{}'::jsonb, '1.0', 'test', 'manual')$$,
  'a user can create their own draft profile'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"user_b","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.resumes),
  0,
  'a different user cannot see the resume'
);

select is(
  (select count(*)::integer from public.resume_profiles),
  0,
  'a different user cannot see the profile'
);

select throws_ok(
  $$insert into public.resume_profiles (resume_id, user_id, version, status, profile, schema_version, prompt_version, source_mode)
    values ('00000000-0000-0000-0000-000000000001', 'user_b', 2, 'draft', '{}'::jsonb, '1.0', 'test', 'manual')$$,
  '42501',
  null,
  'a different user cannot attach a profile to user_a resume'
);

select throws_ok(
  $$insert into public.resumes (id, user_id, original_filename, storage_path, byte_size, ai_processing_consent_at)
    values ('00000000-0000-0000-0000-000000000002', 'user_a', 'other.pdf', 'user_a/other.pdf', 1024, timezone('utc', now()))$$,
  '42501',
  null,
  'a different user cannot create a resume for user_a'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"user_a","role":"authenticated"}',
  true
);

select throws_ok(
  $$update public.resumes set user_id = 'user_b' where id = '00000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'a user cannot reassign resume ownership'
);

select lives_ok(
  $$insert into public.resume_processing_jobs (resume_id, user_id) values ('00000000-0000-0000-0000-000000000001', 'user_a')$$,
  'a user can enqueue their own resume'
);

select throws_ok(
  $$select count(*) from public.resume_processing_jobs$$,
  '42501',
  null,
  'users cannot read worker queue rows'
);

set local role anon;
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  $$select count(*) from public.resumes$$,
  '42501',
  null,
  'anonymous callers cannot read resumes'
);

select throws_ok(
  $$insert into public.resumes (id, user_id, original_filename, storage_path, byte_size, ai_processing_consent_at)
    values ('00000000-0000-0000-0000-000000000003', 'user_a', 'anon.pdf', 'user_a/anon.pdf', 1024, timezone('utc', now()))$$,
  '42501',
  null,
  'anonymous callers cannot create resumes'
);

select finish();
rollback;
