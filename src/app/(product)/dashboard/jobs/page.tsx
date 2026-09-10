import { redirect } from "next/navigation";
import Link from "next/link";

import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type JobsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const dynamic = "force-dynamic";

export default async function JobsPage({ searchParams }: JobsPageProps) {
  try {
    await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/sign-in?redirect_url=/dashboard/jobs");
    }
    throw error;
  }

  const params = await searchParams;
  const search = firstParam(params.search)?.trim().slice(0, 100) ?? "";
  const country = firstParam(params.country)?.trim().slice(0, 2).toUpperCase() ?? "";
  const workplace = firstParam(params.workplace) ?? "";
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("job_postings")
    .select(
      "id,title,description,location_text,country_code,workplace_type,employment_type,seniority,canonical_url,posted_at,companies(display_name),job_sources(provider,display_name)",
    )
    .eq("status", "active");
  if (search)
    query = query.textSearch("search_document", search, { type: "websearch", config: "simple" });
  if (/^[A-Z]{2}$/u.test(country)) query = query.eq("country_code", country);
  if (["onsite", "hybrid", "remote", "unknown"].includes(workplace)) {
    query = query.eq("workplace_type", workplace);
  }
  const { data: jobs, error } = await query
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(40);
  if (error) throw new Error("Could not load jobs");

  return (
    <div className="product-page">
      <div className="page-intro">
        <div>
          <p className="signal-label">
            <span className="signal-dot" aria-hidden="true" />
            Job signal
          </p>
          <h1>A calmer job search.</h1>
          <p>
            Search normalized listings from documented job APIs, then open the match feed for
            deterministic ranking and evidence-grounded explanations.
          </p>
        </div>
        <div className="page-intro-actions">
          <span className="page-count">{jobs?.length ?? 0} active listings</span>
          <Link href="/dashboard/matches" className="button-primary">
            Open Match Feed
          </Link>
        </div>
      </div>

      <form className="job-filter-bar" method="get">
        <label className="sr-only" htmlFor="job-search">
          Search jobs
        </label>
        <input
          id="job-search"
          name="search"
          defaultValue={search}
          placeholder="Try ‘TypeScript’ or ‘product engineer’…"
          autoComplete="off"
          className="product-input"
        />
        <label className="sr-only" htmlFor="job-country">
          Country code
        </label>
        <input
          id="job-country"
          name="country"
          defaultValue={country}
          maxLength={2}
          placeholder="e.g. IN…"
          autoComplete="country"
          className="product-input uppercase"
        />
        <label className="sr-only" htmlFor="job-workplace">
          Workplace type
        </label>
        <select
          id="job-workplace"
          name="workplace"
          defaultValue={workplace}
          className="product-input"
        >
          <option value="">Any workplace</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site</option>
          <option value="unknown">Not specified</option>
        </select>
        <button type="submit" className="button-primary">
          Search Jobs
        </button>
      </form>

      {jobs?.length ? (
        <div className="job-list">
          {jobs.map((job) => {
            const companyName = Array.isArray(job.companies)
              ? (job.companies[0]?.display_name ?? null)
              : (job.companies?.display_name ?? null);
            const sourceName = Array.isArray(job.job_sources)
              ? (job.job_sources[0]?.display_name ?? null)
              : (job.job_sources?.display_name ?? null);
            return (
              <article key={job.id} className="job-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="job-source">
                      {companyName ?? "Company not specified"}
                      {sourceName ? ` · via ${sourceName}` : ""}
                    </p>
                    <h2>{job.title}</h2>
                  </div>
                  <a
                    href={job.canonical_url}
                    target="_blank"
                    rel="noreferrer"
                    className="button-secondary"
                  >
                    View Source
                  </a>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  {job.location_text ? (
                    <span className="profile-chip">{job.location_text}</span>
                  ) : null}
                  <span className="profile-chip profile-chip-violet">{job.workplace_type}</span>
                  {job.employment_type ? (
                    <span className="profile-chip">{job.employment_type}</span>
                  ) : null}
                  {job.seniority ? <span className="profile-chip">{job.seniority}</span> : null}
                </div>
                <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--muted)]">
                  {job.description.slice(0, 360)}
                  {job.description.length > 360 ? "…" : ""}
                </p>
                <p className="mt-4 text-xs text-[var(--quiet)]">
                  {job.posted_at
                    ? `Posted ${new Intl.DateTimeFormat("en-IN").format(new Date(job.posted_at))}`
                    : "Posting date not provided"}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state jobs-empty">
          <p className="text-lg font-bold text-[var(--foreground)]">No normalized listings yet.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Configure an Adzuna query or a curated Greenhouse/Lever board, then run the bounded
            ingestion worker. This empty state is intentional; ResuLens never invents job data.
          </p>
        </div>
      )}
    </div>
  );
}
