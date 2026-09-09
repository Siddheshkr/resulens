-- Keep jobs with missing location/workplace metadata in the candidate union so
-- the application can label them as unknown rather than silently treating
-- missing provider data as a confirmed conflict.
create or replace function public.search_job_candidates(
  p_resume_embedding extensions.vector(1536) default null,
  p_query text default null,
  p_country_codes text[] default '{}'::text[],
  p_workplace_types text[] default '{}'::text[],
  p_role_exclusions text[] default '{}'::text[],
  p_limit integer default 100
)
returns table (
  job_posting_id uuid,
  lexical_score real,
  semantic_score real,
  retrieval_source text
)
language sql
stable
set search_path = public, extensions, pg_catalog
as $$
  with eligible as (
    select j.*
    from public.job_postings j
    where j.status = 'active'
      and (
        cardinality(coalesce(p_country_codes, '{}'::text[])) = 0
        or j.country_code is null
        or j.country_code = any(p_country_codes)
      )
      and (
        cardinality(coalesce(p_workplace_types, '{}'::text[])) = 0
        or j.workplace_type = 'unknown'
        or j.workplace_type = any(p_workplace_types)
      )
      and not exists (
        select 1
        from unnest(coalesce(p_role_exclusions, '{}'::text[])) as exclusion(term)
        where lower(j.title || ' ' || j.description) like '%' || lower(exclusion.term) || '%'
      )
  ),
  lexical as (
    select
      e.id as job_posting_id,
      least(
        1::real,
        greatest(
          0::real,
          ts_rank_cd(
            e.search_document,
            websearch_to_tsquery('simple', nullif(trim(p_query), ''))
          )
        )
      ) as lexical_score
    from eligible e
    where nullif(trim(p_query), '') is not null
      and e.search_document @@ websearch_to_tsquery('simple', trim(p_query))
    order by lexical_score desc, e.posted_at desc nulls last, e.id
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ),
  semantic as (
    select
      e.job_posting_id,
      least(
        1::real,
        greatest(0::real, (1 - (e.embedding <=> p_resume_embedding))::real)
      ) as semantic_score
    from public.job_posting_embeddings e
    join eligible j on j.id = e.job_posting_id
    where p_resume_embedding is not null
    order by e.embedding <=> p_resume_embedding
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ),
  combined as (
    select l.job_posting_id, l.lexical_score, null::real as semantic_score
    from lexical l
    union all
    select s.job_posting_id, null::real as lexical_score, s.semantic_score
    from semantic s
  )
  select
    c.job_posting_id,
    max(c.lexical_score) as lexical_score,
    max(c.semantic_score) as semantic_score,
    case
      when max(c.lexical_score) is not null and max(c.semantic_score) is not null then 'hybrid'
      when max(c.semantic_score) is not null then 'vector'
      else 'full_text'
    end as retrieval_source
  from combined c
  group by c.job_posting_id
  order by greatest(coalesce(max(c.lexical_score), 0), coalesce(max(c.semantic_score), 0)) desc,
    c.job_posting_id
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.search_job_candidates(
  extensions.vector(1536), text, text[], text[], text[], integer
) from public, anon, authenticated;
grant execute on function public.search_job_candidates(
  extensions.vector(1536), text, text[], text[], text[], integer
) to service_role;
