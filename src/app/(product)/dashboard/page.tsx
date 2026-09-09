import { redirect } from "next/navigation";

import Link from "next/link";

import { ResumeUploadCard } from "@/components/resume-upload-card";
import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  if (profileError) {
    throw new Error(`Could not initialize the profile: ${profileError.message}`);
  }

  const { data: resumes, error: resumesError } = await supabase
    .from("resumes")
    .select("id,original_filename,status,processing_stage,page_count,created_at,error_message")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (resumesError) {
    throw new Error("Could not load resumes");
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--foreground)]">
            Make the next move legible.
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
            Upload a resume, review the structured read, and keep your private profile under your
            control.
          </p>
        </div>
        <p className="text-xs text-[var(--quiet)]">
          {resumes?.length ?? 0} resume{resumes?.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href="/dashboard/jobs" className="header-cta">
          Browse jobs
        </Link>
        <p className="text-xs text-[var(--quiet)]">Normalized listings from documented sources.</p>
      </div>

      <div className="mt-10">
        <ResumeUploadCard />
      </div>

      <section className="mt-10" aria-labelledby="resume-history-title">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Private history</p>
            <h2
              id="resume-history-title"
              className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--foreground)]"
            >
              Your scans
            </h2>
          </div>
        </div>
        {resumes?.length ? (
          <div className="mt-5 grid gap-3">
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
                    {new Date(resume.created_at).toLocaleDateString("en-IN")}
                  </p>
                  {resume.error_message ? (
                    <p className="mt-2 text-xs text-[#ff9285]">{resume.error_message}</p>
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
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-black/20 px-5 py-8 text-sm text-[var(--muted)]">
            Your first private scan will appear here.
          </div>
        )}
      </section>
    </div>
  );
}
