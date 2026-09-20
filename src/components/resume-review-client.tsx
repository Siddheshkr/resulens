"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ResumeProfileReview } from "@/components/resume-profile-review";
import { resumeProfileSchema, type ResumeProfile } from "@/lib/resumes/profile-schema";

type ResumeSummary = {
  id: string;
  original_filename: string;
  status: string;
  processing_stage: string;
  page_count: number | null;
  error_message: string | null;
};

type Props = {
  initialResume: ResumeSummary;
  initialProfile: { profile: unknown; status: string } | null;
};

function statusCopy(resume: ResumeSummary) {
  if (resume.status === "failed") {
    return {
      title: "Scan needs attention",
      description: resume.error_message ?? "Try the scan again.",
    };
  }
  if (resume.status === "needs_review") {
    return {
      title: "Your profile is ready",
      description: "Review the extracted facts before they influence matches.",
    };
  }
  if (resume.status === "deleting") {
    return {
      title: "Deleting this resume",
      description: "The file, profile versions, and queued work are being removed.",
    };
  }
  if (resume.status === "delete_failed") {
    return {
      title: "Deletion needs attention",
      description: resume.error_message ?? "The resume could not be deleted yet.",
    };
  }
  if (resume.status === "approved") {
    return {
      title: "Profile approved",
      description: "This profile version is ready for matching and can still be corrected safely.",
    };
  }
  return {
    title: "Scanning your resume",
    description: "This may take a moment. You can leave this page and return later.",
  };
}

export function ResumeReviewClient({ initialResume, initialProfile }: Props) {
  const router = useRouter();
  const [resume, setResume] = useState(initialResume);
  const [profile, setProfile] = useState<ResumeProfile | null>(() => {
    const parsed = resumeProfileSchema.safeParse(initialProfile?.profile);
    return parsed.success ? parsed.data : null;
  });
  const [profileStatus, setProfileStatus] = useState(initialProfile?.status ?? "draft");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!["queued", "processing", "uploaded", "pending_upload"].includes(resume.status)) {
      return;
    }

    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/resumes/${resume.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as {
        resume: ResumeSummary;
        profile: { profile: unknown; status: string } | null;
      };
      setResume(payload.resume);
      const nextProfile = resumeProfileSchema.safeParse(payload.profile?.profile);
      if (nextProfile.success) {
        setProfile(nextProfile.data);
        setProfileStatus(payload.profile?.status ?? "draft");
      }
    }, 3_000);

    return () => window.clearInterval(timer);
  }, [resume.id, resume.status]);

  async function retry() {
    setActionError(null);
    const response = await fetch(`/api/resumes/${resume.id}/retry`, { method: "POST" });
    const payload = (await response.json()) as { error?: string; status?: string };
    if (!response.ok) {
      setActionError(payload.error ?? "Could not retry the scan.");
      return;
    }
    if (payload.status === "deleted") {
      router.push("/dashboard");
      return;
    }
    setResume((current) => ({
      ...current,
      status: payload.status ?? "queued",
      processing_stage: "queued",
      error_message: null,
    }));
  }

  async function deleteResume() {
    if (!window.confirm("Delete this resume and every derived profile version?")) return;
    setActionError(null);
    const response = await fetch(`/api/resumes/${resume.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setActionError(payload.error ?? "Could not delete the resume.");
      return;
    }
    router.push("/dashboard");
  }

  const copy = statusCopy(resume);

  return (
    <div className="product-page resume-review-page">
      <Link href="/dashboard" className="button-secondary">
        Back to Workspace
      </Link>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="signal-label">
            <span className="signal-dot" aria-hidden="true" />
            Resume scan
          </p>
          <h1 className="resume-review-title">{resume.original_filename}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {resume.page_count
              ? `${resume.page_count} page${resume.page_count === 1 ? "" : "s"}`
              : "Page count pending"}
          </p>
        </div>
        <button
          className="button-secondary destructive-button"
          type="button"
          onClick={() => void deleteResume()}
        >
          Delete Resume
        </button>
      </div>

      <div className="resume-status-panel" aria-live="polite">
        <div className="flex items-start gap-4">
          <span className={`processing-dot processing-dot-${resume.status}`} aria-hidden="true" />
          <div>
            <h2 className="text-xl font-bold text-[var(--foreground)]">{copy.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {copy.description}
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.15em] text-[var(--quiet)]">
              Stage: {resume.processing_stage.replaceAll("_", " ")}
            </p>
          </div>
        </div>
        {resume.status === "failed" ||
        resume.status === "delete_failed" ||
        resume.status === "deleting" ? (
          <button
            className="button-primary mt-6"
            type="button"
            onClick={() => void retry()}
          >
            {resume.status === "delete_failed" || resume.status === "deleting"
              ? "Retry deletion"
              : "Retry scan"}
          </button>
        ) : null}
      </div>

      {actionError ? (
        <p className="form-error mt-4" role="alert">
          {actionError}
        </p>
      ) : null}

      {profile ? (
        <div className="mt-8">
          <ResumeProfileReview
            resumeId={resume.id}
            profile={profile}
            approved={profileStatus === "approved" || resume.status === "approved"}
            onUpdated={(nextProfile, status) => {
              setProfile(nextProfile);
              setProfileStatus(status);
              setResume((current) => ({ ...current, status }));
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
