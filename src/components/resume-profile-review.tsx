"use client";

import { useEffect, useState } from "react";

import { StatusPill } from "@/components/status-pill";
import { resumeProfileSchema, type ResumeProfile } from "@/lib/resumes/profile-schema";

type Props = {
  resumeId: string;
  profile: ResumeProfile;
  approved: boolean;
  onUpdated: (profile: ResumeProfile, status: "needs_review" | "approved") => void;
};

export function ResumeProfileReview({ resumeId, profile, approved, onUpdated }: Props) {
  const initialDraft = JSON.stringify(profile, null, 2);
  const [draft, setDraft] = useState(initialDraft);
  const [savedDraft, setSavedDraft] = useState(initialDraft);
  const [editing, setEditing] = useState(!approved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!editing || draft === savedDraft) return;

    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    return () => window.removeEventListener("beforeunload", warnBeforeLeaving);
  }, [draft, editing, savedDraft]);

  async function save(approve: boolean) {
    setError(null);
    setMessage(null);
    let candidate: unknown;

    try {
      candidate = JSON.parse(draft);
    } catch {
      setError("Profile JSON is not valid. Fix the syntax and try again.");
      return;
    }

    const parsed = resumeProfileSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(
        "The profile shape is invalid. Keep every field from the template and use null for unknown values.",
      );
      return;
    }

    setBusy(true);
    try {
      const saveResponse = await fetch(`/api/resumes/${resumeId}/profile`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: parsed.data }),
      });
      const savePayload = (await saveResponse.json()) as {
        error?: string;
        profile?: { profile: ResumeProfile };
      };
      if (!saveResponse.ok || !savePayload.profile) {
        throw new Error(savePayload.error ?? "Could not save the profile.");
      }

      let status: "needs_review" | "approved" = "needs_review";
      if (approve) {
        const approveResponse = await fetch(`/api/resumes/${resumeId}/approve`, { method: "POST" });
        const approvePayload = (await approveResponse.json()) as {
          error?: string;
          profile?: { profile: ResumeProfile };
        };
        if (!approveResponse.ok || !approvePayload.profile) {
          throw new Error(approvePayload.error ?? "Could not approve the profile.");
        }
        status = "approved";
        setEditing(false);
        const approvedDraft = JSON.stringify(approvePayload.profile.profile, null, 2);
        setDraft(approvedDraft);
        setSavedDraft(approvedDraft);
        onUpdated(approvePayload.profile.profile, status);
      } else {
        const updatedDraft = JSON.stringify(savePayload.profile.profile, null, 2);
        setDraft(updatedDraft);
        setSavedDraft(updatedDraft);
        onUpdated(savePayload.profile.profile, status);
        setEditing(true);
      }
      setMessage(
        status === "approved"
          ? "Profile approved. Future matches will use this version."
          : "Draft saved. Review it once more before approval.",
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save the profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="resume-review-card" aria-labelledby="profile-review-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">Profile review</p>
          <h2
            id="profile-review-title"
            className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--foreground)]"
          >
            Correct the read before matching
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            The structured profile stays editable and versioned. Evidence excerpts remain attached
            so you can see where a claim came from.
          </p>
        </div>
        <StatusPill
          status={approved ? "approved" : "needs_review"}
          label={approved ? "Approved" : "Needs review"}
        />
      </div>

      <label
        className="mt-6 block text-sm font-semibold text-[var(--foreground)]"
        htmlFor="profile-json"
      >
        Structured profile
        <textarea
          id="profile-json"
          className="profile-json-editor"
          name="profile-json"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          spellCheck={false}
          disabled={busy || (approved && !editing)}
        />
      </label>

      <p className="mt-3 text-xs leading-5 text-[var(--quiet)]">
        Keep arrays as arrays, preserve evidence page numbers, and use null when the resume does not
        provide a fact. Approving creates a new profile version and invalidates future derived
        matches.
      </p>
      {message ? (
        <p className="form-message mt-4" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error mt-4" role="alert">
          {error}
        </p>
      ) : null}

      {approved && !editing ? (
        <button
          className="button-secondary mt-6"
          type="button"
          onClick={() => {
            setEditing(true);
            setMessage(
              "Editing creates a draft and invalidates older matching signals when saved.",
            );
          }}
          disabled={busy}
        >
          Edit Approved Profile
        </button>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="button-secondary"
            type="button"
            onClick={() => void save(false)}
            disabled={busy}
          >
            {busy ? "Saving…" : "Save Draft"}
          </button>
          <button
            className="button-primary"
            type="button"
            onClick={() => void save(true)}
            disabled={busy}
          >
            {approved ? "Save & Approve New Version" : "Approve Profile"}
          </button>
        </div>
      )}
    </section>
  );
}
