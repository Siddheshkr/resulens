import { redirect } from "next/navigation";

import Link from "next/link";

import { ResumeUploadCard } from "@/components/resume-upload-card";
import { OnboardingPanel } from "@/components/onboarding-panel";
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
          <h1>Make the next move legible.</h1>
          <p>
            Upload a resume, review the structured read, and keep your private profile under your
            control.
          </p>
        </div>
        <p className="page-count">
          {resumes?.length ?? 0} resume{resumes?.length === 1 ? "" : "s"}
        </p>
      </div>

      {!account?.onboarding_completed_at ? (
        <OnboardingPanel hasResume={Boolean(resumes?.length)} />
      ) : null}

      <div className="workspace-actions">
        <Link href="/dashboard/jobs" className="button-primary">
          Browse Jobs
        </Link>
        <Link href="/dashboard/matches" className="button-secondary">
          Match My Resume
        </Link>
        <p>Normalized listings from documented sources.</p>
      </div>

      <div className="workspace-grid">
        <ResumeUploadCard />

        <section className="workspace-history" aria-labelledby="resume-history-title">
          <div>
            <p className="eyebrow">Private history</p>
            <h2 id="resume-history-title">Your scans</h2>
          </div>
          {resumes?.length ? (
            <div className="history-list">
              {resumes.map((resume) => (
                <Link
                  key={resume.id}
                  href={`/dashboard/resumes/${resume.id}`}
                  className="resume-history-row"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--foreground)]">
                      {resume.original_filename}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {resume.page_count ? `${resume.page_count} pages` : "Page count pending"} ·{" "}
                      {new Intl.DateTimeFormat("en-IN").format(new Date(resume.created_at))}
                    </p>
                    {resume.error_message ? (
                      <p className="mt-2 text-xs text-[var(--danger)]">{resume.error_message}</p>
                    ) : null}
                  </div>
                  <span
                    className={`status-pill ${resume.status === "approved" ? "status-pill-success" : ""}`}
                  >
                    {resume.status.replaceAll("_", " ")}
                  </span>
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
