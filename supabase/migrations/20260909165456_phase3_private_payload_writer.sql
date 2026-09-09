-- Keep the raw provider payload outside the exposed schema while allowing the
-- trusted ingestion worker to persist it through a narrowly scoped RPC.
create or replace function public.upsert_job_posting_payload(
  p_job_posting_id uuid,
  p_source_id uuid,
  p_payload jsonb,
  p_content_fingerprint text
)
returns void
language sql
security definer
set search_path = private, pg_catalog
as $$
  insert into private.job_posting_payloads (
    job_posting_id,
    source_id,
    payload,
    content_fingerprint,
    captured_at
  )
  values (
    p_job_posting_id,
    p_source_id,
    p_payload,
    p_content_fingerprint,
    timezone('utc', now())
  )
  on conflict (job_posting_id) do update set
    source_id = excluded.source_id,
    payload = excluded.payload,
    content_fingerprint = excluded.content_fingerprint,
    captured_at = excluded.captured_at;
$$;

revoke all on function public.upsert_job_posting_payload(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.upsert_job_posting_payload(uuid, uuid, jsonb, text)
  to service_role;

