begin;

select plan(8);

set local role service_role;
insert into public.profiles (user_id) values ('phase5_user_a'), ('phase5_user_b');
insert into public.resumes (
  id, user_id, original_filename, storage_path, byte_size, ai_processing_consent_at
) values (
  '00000000-0000-0000-0000-000000000501', 'phase5_user_a', 'synthetic.pdf',
  'phase5_user_a/00000000-0000-0000-0000-000000000501.pdf', 1024, timezone('utc', now())
);
insert into public.account_deletion_jobs (user_id, source)
values ('phase5_cleanup_only', 'clerk_webhook');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"phase5_user_a","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set raw_file_retention_policy = 'retain_30_days' where user_id = 'phase5_user_a'$$,
  'a user can select their own raw-file retention policy'
);
select is(
  (select raw_file_retention_policy from public.profiles where user_id = 'phase5_user_a'),
  'retain_30_days',
  'the selected retention policy is visible to its owner'
);
select lives_ok(
  $$update public.profiles set raw_file_retention_policy = 'retain_30_days' where user_id = 'phase5_user_b'$$,
  'a cross-account update cannot target a hidden row'
);
set local role service_role;
select is(
  (select raw_file_retention_policy from public.profiles where user_id = 'phase5_user_b'),
  'delete_after_approval',
  'a hidden cross-account update leaves the other policy unchanged'
);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"phase5_user_a","role":"authenticated"}', true);
select throws_ok(
  $$select count(*) from public.account_deletion_jobs$$,
  '42501',
  null,
  'account cleanup jobs are not exposed to authenticated users'
);

set local role service_role;
update public.profiles
set deletion_requested_at = timezone('utc', now()), deletion_status = 'pending'
where user_id = 'phase5_user_a';

select throws_ok(
  $$update public.resumes set original_filename = 'changed.pdf' where id = '00000000-0000-0000-0000-000000000501'$$,
  'P0001',
  'account_deletion_in_progress',
  'resume writes stop as soon as account deletion is requested'
);
select throws_ok(
  $$insert into public.candidate_preferences (user_id) values ('phase5_user_a')$$,
  'P0001',
  'account_deletion_in_progress',
  'new preference work is blocked during account deletion'
);
select lives_ok(
  $$delete from public.profiles where user_id = 'phase5_user_a'$$,
  'cleanup can still delete the profile and all derived rows'
);

select finish();
rollback;
