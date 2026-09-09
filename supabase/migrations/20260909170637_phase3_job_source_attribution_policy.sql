-- Expose only non-sensitive source attribution to authenticated job readers.
-- Provider configuration remains hidden because it may contain board metadata
-- and is not part of the client contract.
grant select (id, provider, slug, display_name, status)
  on table public.job_sources to authenticated;

create policy "Authenticated users can view active source attribution"
  on public.job_sources for select to authenticated
  using (status = 'active');

