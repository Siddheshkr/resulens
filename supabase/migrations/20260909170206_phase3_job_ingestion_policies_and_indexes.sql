-- Service-managed tables still receive explicit policies so security linting
-- makes their intended access boundary visible in the schema.
create policy "Only trusted workers can manage job sources"
  on public.job_sources for all to service_role
  using (true)
  with check (true);

create policy "Only trusted workers can manage ingestion runs"
  on public.ingestion_runs for all to service_role
  using (true)
  with check (true);

create policy "Only trusted workers can manage raw provider payloads"
  on private.job_posting_payloads for all to service_role
  using (true)
  with check (true);

create index job_posting_payloads_source_idx
  on private.job_posting_payloads (source_id);

