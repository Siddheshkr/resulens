import { redirect } from "next/navigation";

import Link from "next/link";

import { OnboardingPanel } from "@/components/onboarding-panel";
import { ResumeUploadCard } from "@/components/resume-upload-card";
import { StatusPill } from "@/components/status-pill";
import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ensureUserProfile } from "@/server/accounts/profile";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let userId: string;

  try {
    ({ userId } = await requireUser());
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/sign-in?redirect_url=/dashboard");
    }

    throw error;
  }

  const supabase = await createServerSupabaseClient();
  const account = await ensureUserProfile(supabase, userId);

  const { data: resumes, error: resumesError } = await supabase
    .from("resumes")
    .select("id,original_filename,status,processing_stage,page_count,created_at,error_message")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (resumesError) {
    throw new Error("Could not load resumes");
  }

  return (
    <div className="product-page">
      <div className="page-intro">
        <div>
          <p className="signal-label">
            <span className="signal-dot" aria-hidden="true" />
            Your workspace
          </p>
          <h1>Read your resume. Find the work.</h1>
          <p>
            Upload a private PDF, inspect the extracted claims, and approve a version before it
            shapes matches.
          </p>
        </div>
        <div className="page-intro-actions">
          <Link href="/dashboard/matches" className="button-primary">
            Open Match Feed
          </Link>
          <Link href="/dashboard/jobs" className="button-secondary">
            Browse Jobs
          </Link>
        </div>
      </div>

      {!account.onboarding_completed_at ? (
        <OnboardingPanel hasResume={Boolean(resumes?.length)} />
      ) : null}

      <div className="workspace-grid">
        <ResumeUploadCard />

        <section className="resume-history-panel" aria-labelledby="resume-history-title">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Document history</p>
              <h2 id="resume-history-title">Resume scans</h2>
            </div>
            <span className="page-count">{resumes?.length ?? 0} scans</span>
          </div>

          {resumes?.length ? (
            <div className="mt-6 grid gap-3">
              {resumes.map((resume) => (
                <Link
                  key={resume.id}
                  href={`/dashboard/resumes/${resume.id}`}
                  className="resume-history-row group"
                >
                  <div>
                    <strong>{resume.original_filename}</strong>
                    <p className="text-xs text-[var(--muted)]">
                      {resume.page_count
                        ? `${resume.page_count} page${resume.page_count === 1 ? "" : "s"}`
                        : "Page count pending"}{" "}
                      · stage: {resume.processing_stage.replaceAll("_", " ")}
                    </p>
                    {resume.error_message ? (
                      <p className="mt-2 text-xs text-[var(--danger)]">{resume.error_message}</p>
                    ) : null}
                  </div>
                  <StatusPill status={resume.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>No scans yet</strong>
              <p>Your first private resume scan will appear here.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
