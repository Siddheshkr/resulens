-- Job actions, feedback, and explanations may only reference a matching result
-- owned by the same user and containing the same job. Application code also
-- validates this boundary, while these triggers protect every database caller.

do $$
begin
  if exists (
    select 1
    from public.job_actions action
    where action.match_run_id is not null
      and not exists (
        select 1
        from public.job_matches match
        where match.match_run_id = action.match_run_id
          and match.user_id = action.user_id
          and match.job_posting_id = action.job_posting_id
      )
  ) or exists (
    select 1
    from public.job_feedback feedback
    where feedback.match_run_id is not null
      and not exists (
        select 1
        from public.job_matches match
        where match.match_run_id = feedback.match_run_id
          and match.user_id = feedback.user_id
          and match.job_posting_id = feedback.job_posting_id
      )
  ) or exists (
    select 1
    from public.job_match_explanations explanation
    where not exists (
      select 1
      from public.job_matches match
      where match.id = explanation.job_match_id
        and match.match_run_id = explanation.match_run_id
        and match.user_id = explanation.user_id
        and match.job_posting_id = explanation.job_posting_id
    )
  ) then
    raise exception 'Existing matching references are inconsistent; repair them before applying this migration';
  end if;
end;
$$;

create or replace function public.enforce_job_match_reference_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'job_match_explanations' then
    if not exists (
      select 1
      from public.job_matches match
      where match.id = new.job_match_id
        and match.match_run_id = new.match_run_id
        and match.user_id = new.user_id
        and match.job_posting_id = new.job_posting_id
    ) then
      raise foreign_key_violation using
        message = 'Explanation must reference the same owned job match';
    end if;
  elsif new.match_run_id is not null and not exists (
    select 1
    from public.job_matches match
    where match.match_run_id = new.match_run_id
      and match.user_id = new.user_id
      and match.job_posting_id = new.job_posting_id
  ) then
    raise foreign_key_violation using
      message = 'Action or feedback must reference the same owned job match';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_job_match_reference_integrity() from public, anon, authenticated;

create trigger job_actions_enforce_match_reference
  before insert or update of user_id, job_posting_id, match_run_id on public.job_actions
  for each row execute function public.enforce_job_match_reference_integrity();

create trigger job_feedback_enforce_match_reference
  before insert or update of user_id, job_posting_id, match_run_id on public.job_feedback
  for each row execute function public.enforce_job_match_reference_integrity();

create trigger job_match_explanations_enforce_reference
  before insert or update of job_match_id, match_run_id, user_id, job_posting_id
  on public.job_match_explanations
  for each row execute function public.enforce_job_match_reference_integrity();

comment on function public.enforce_job_match_reference_integrity() is
  'Prevents cross-user or cross-job references in matching actions, feedback, and explanations.';
