import { notFound, redirect } from "next/navigation";

import Link from "next/link";

import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function JobDetailsPage({ params }: PageProps) {
  try {
    await requireUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError)
      redirect("/sign-in?redirect_url=/dashboard/jobs");
    throw error;
  }
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: job, error } = await supabase
    .from("job_postings")
    .select(
      "id,title,description,location_text,country_code,workplace_type,employment_type,seniority,canonical_url,posted_at,source_updated_at,salary_min,salary_max,salary_currency,work_authorization_support,required_experience_min_years,required_experience_max_years,companies(display_name),job_sources(provider,display_name)",
    )
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error("Could not load the job");
  if (!job) notFound();
  const companyName = Array.isArray(job.companies)
    ? job.companies[0]?.display_name
    : job.companies?.display_name;
  const sourceName = Array.isArray(job.job_sources)
    ? job.job_sources[0]?.display_name
    : job.job_sources?.display_name;
  return (
    <div className="product-page job-detail-page">
      <Link href="/dashboard/matches" className="button-secondary">
        Back to Matches
      </Link>
      <article className="job-detail-card">
        <p className="signal-label">
          {companyName ?? "Company not specified"}
          {sourceName ? ` · ${sourceName}` : ""}
        </p>
        <h1>{job.title}</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          <span className="profile-chip">{job.location_text ?? "Location not specified"}</span>
          <span className="profile-chip profile-chip-violet">{job.workplace_type}</span>
          {job.employment_type ? <span className="profile-chip">{job.employment_type}</span> : null}
          {job.seniority ? <span className="profile-chip">{job.seniority}</span> : null}
        </div>
        <p className="job-description">{job.description}</p>
        <div className="job-facts">
          <p>
            <strong className="text-[var(--foreground)]">Work authorization:</strong>{" "}
            {job.work_authorization_support.replaceAll("_", " ")}
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Experience:</strong>{" "}
            {job.required_experience_min_years ?? "Not specified"}
            {job.required_experience_max_years ? `–${job.required_experience_max_years}` : ""} years
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Salary:</strong>{" "}
            {(job.salary_min ?? job.salary_max)
              ? `${job.salary_min ?? "?"}–${job.salary_max ?? "?"} ${job.salary_currency ?? ""}`
              : "Not specified"}
          </p>
          <p>
            <strong className="text-[var(--foreground)]">Posted:</strong>{" "}
            {job.posted_at
              ? new Intl.DateTimeFormat("en-IN").format(new Date(job.posted_at))
              : "Not specified"}
          </p>
        </div>
        <a
          href={job.canonical_url}
          target="_blank"
          rel="noreferrer"
          className="button-primary job-apply-link"
        >
          Open Application Page
        </a>
        <p className="mt-3 text-xs text-[var(--quiet)]">
          Opening the source never marks this job as applied. Use the explicit action in your match
          feed.
        </p>
      </article>
    </div>
  );
}
