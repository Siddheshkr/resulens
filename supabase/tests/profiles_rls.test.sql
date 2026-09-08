begin;

select plan(8);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"user_a","role":"authenticated"}',
  true
);

insert into public.profiles (user_id) values ('user_a');

select is(
  (select count(*)::integer from public.profiles),
  1,
  'a user can see their own profile'
);

select is(
  (select user_id from public.profiles limit 1),
  'user_a',
  'the profile belongs to the authenticated Clerk subject'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"user_b","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.profiles),
  0,
  'a different user cannot see the profile'
);

select throws_ok(
  $$insert into public.profiles (user_id) values ('user_a')$$,
  '42501',
  null,
  'a different user cannot insert a profile for user_a'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"user_a","role":"authenticated"}',
  true
);

select throws_ok(
  $$update public.profiles set user_id = 'user_b' where user_id = 'user_a'$$,
  '42501',
  null,
  'a user cannot reassign profile ownership'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"user_a","role":"authenticated"}',
  true
);

select lives_ok(
  $$update public.profiles set updated_at = timezone('utc', now()) where user_id = 'user_a'$$,
  'a user can update their own profile'
);

select lives_ok(
  $$delete from public.profiles where user_id = 'user_a'$$,
  'a user can delete their own profile'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"user_b","role":"authenticated"}',
  true
);

select is(
  (select count(*)::integer from public.profiles),
  0,
  'the deleted profile is no longer visible'
);

select finish();
rollback;
