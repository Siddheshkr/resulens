"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  MATCH_POLL_ATTEMPTS,
  MATCH_POLL_INTERVAL_MS,
  shouldResumePendingMatch,
} from "@/lib/matching/polling";

type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue | undefined };

type ResumeOption = {
  id: string;
  original_filename: string;
  status: string;
  approved_profile_version: number | null;
};

type Preferences = {
  revision: number;
  countryCodes: string[];
  preferredLocations: string[];
  workplaceTypes: string[];
  roleExclusions: string[];
  minimumExperienceYears: number | null;
  maximumExperienceYears: number | null;
  salaryMinimum: number | null;
  salaryCurrency: string | null;
  workAuthorizationStatus: "authorized" | "needs_sponsorship" | "unknown";
};

type Job = {
  id: string;
  title: string;
  description: string;
  location_text: string | null;
  country_code: string | null;
  workplace_type: string;
  employment_type: string | null;
  seniority: string | null;
  canonical_url: string;
  posted_at: string | null;
  source_updated_at: string | null;
  companies: { display_name: string } | { display_name: string }[] | null;
  job_sources:
    | { provider: string; display_name: string }
    | { provider: string; display_name: string }[]
    | null;
};

type Explanation = {
  status: string;
  explanation: JsonValue | null;
  error_message: string | null;
};

type Match = {
  id: string;
  rank: number;
  match_score: number;
  score_breakdown: JsonValue;
  eligibility: JsonValue;
  evidence: JsonValue;
  job_posting_id: string;
  job: Job | null;
  action: string | null;
  explanation: Explanation | null;
};

type MatchRun = {
  run: {
    id: string;
    resume_id: string;
    status: string;
    candidate_count: number;
    explanation_status: string;
    resume_profile_version: number;
    preferences_revision: number;
    scoring_version: string;
    created_at: string;
  };
  matches: Match[];
};

type Props = {
  resumes: ResumeOption[];
  initialPreferences: Preferences;
  initialRun: MatchRun | null;
};

const signalLabels: Record<string, string> = {
  semanticSimilarity: "Semantic",
  skills: "Skills",
  roleSeniority: "Role / level",
  location: "Location",
  freshness: "Freshness",
  salary: "Salary",
};

function relatedName(value: Job["companies"] | Job["job_sources"]) {
  if (Array.isArray(value)) return value[0]?.display_name ?? null;
  return value?.display_name ?? null;
}

function asRecord(value: JsonValue): Record<string, JsonValue | undefined> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function asStrings(value: JsonValue | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function scoreSignals(value: JsonValue) {
  const record = asRecord(value);
  const signals = record?.signals;
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return [];
  return Object.entries(signals).flatMap(([name, raw]) => {
    const signal = asRecord(raw ?? null);
    const signalValue = signal?.value;
    if (typeof signalValue !== "number") return [];
    return [{ name, value: signalValue }];
  });
}

function inputValue(value: string[]) {
  return value.join(", ");
}

export function MatchFeed({ resumes, initialPreferences, initialRun }: Props) {
  const approvedResumes = useMemo(
    () =>
      resumes.filter((resume) => resume.status === "approved" && resume.approved_profile_version),
    [resumes],
  );
  const [resumeId, setResumeId] = useState(
    initialRun?.run.resume_id ?? approvedResumes[0]?.id ?? "",
  );
  const [preferences, setPreferences] = useState(initialPreferences);
  const [run, setRun] = useState<MatchRun | null>(initialRun);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadRun(runId: string) {
    const response = await fetch(`/api/matches/${runId}`, { cache: "no-store" });
    const payload = (await response.json()) as { run?: MatchRun; error?: string };
    if (!response.ok || !payload.run) throw new Error(payload.error ?? "Could not load matches.");
    setRun(payload.run);
    return payload.run;
  }

  async function createRun() {
    if (!resumeId) {
      setError("Approve a resume before matching.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage("Checking your approved profile and job signals…");
    try {
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resumeId,
          preferences: {
            countryCodes: preferences.countryCodes,
            preferredLocations: preferences.preferredLocations,
            workplaceTypes: preferences.workplaceTypes,
            roleExclusions: preferences.roleExclusions,
            minimumExperienceYears: preferences.minimumExperienceYears,
            maximumExperienceYears: preferences.maximumExperienceYears,
            salaryMinimum: preferences.salaryMinimum,
            salaryCurrency: preferences.salaryCurrency,
            workAuthorizationStatus: preferences.workAuthorizationStatus,
          },
        }),
      });
      const payload = (await response.json()) as {
        runId?: string;
        status?: string;
        error?: string;
      };
      if (!response.ok || !payload.runId)
        throw new Error(payload.error ?? "Could not start matching.");
      let current = await loadRun(payload.runId);
      let attempts = 0;
      while (current.run.status === "embedding_pending" && attempts < MATCH_POLL_ATTEMPTS) {
        attempts += 1;
        setMessage(
          `Preparing your private matching signal… check ${attempts} of ${MATCH_POLL_ATTEMPTS}`,
        );
        await new Promise((resolve) => window.setTimeout(resolve, MATCH_POLL_INTERVAL_MS));
        current = await loadRun(payload.runId);

        // Creating a run is rate limited. Poll its read-only status frequently, but only
        // ask the server to resume deterministic ranking every fourth check.
        if (current.run.status === "embedding_pending" && shouldResumePendingMatch(attempts)) {
          const retryResponse = await fetch("/api/matches", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ resumeId }),
          });
          const retryPayload = (await retryResponse.json()) as {
            runId?: string;
            error?: string;
          };
          if (!retryResponse.ok || !retryPayload.runId) {
            throw new Error(retryPayload.error ?? "Matching is still processing.");
          }
          current = await loadRun(retryPayload.runId);
        }
      }
      setMessage(
        current.run.status === "succeeded"
          ? `${current.matches.length} eligible matches ranked with a deterministic ResuLens match score.`
          : "Matching is still processing. You can refresh this page in a moment.",
      );
    } catch (matchError) {
      setError(matchError instanceof Error ? matchError.message : "Matching failed. Try again.");
      setMessage(null);
    } finally {
      setBusy(false);
    }
  }

  async function updateAction(
    jobId: string,
    state: "saved" | "dismissed" | "applied",
    matchRunId: string,
  ) {
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${jobId}/action`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, matchRunId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not save that action.");
      await loadRun(matchRunId);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not save that action.");
    }
  }

  async function explain(matchId: string, matchRunId: string) {
    setError(null);
    setMessage("Writing a grounded explanation from stored evidence…");
    try {
      const response = await fetch(`/api/matches/${matchRunId}/explanations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobMatchId: matchId }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not generate an explanation.");
      await loadRun(matchRunId);
    } catch (explanationError) {
      setError(
        explanationError instanceof Error ? explanationError.message : "Explanation failed.",
      );
    } finally {
      setMessage(null);
    }
  }

  async function explainTopMatches(matchRunId: string) {
    setError(null);
    setMessage("Preparing grounded explanations for the top ten results…");
    try {
      const response = await fetch(`/api/matches/${matchRunId}/explanations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not generate explanations.");
      await loadRun(matchRunId);
    } catch (explanationError) {
      setError(
        explanationError instanceof Error
          ? explanationError.message
          : "Explanation generation failed.",
      );
    } finally {
      setMessage(null);
    }
  }

  async function sendFeedback(
    jobId: string,
    label: "relevant" | "not_relevant",
    matchRunId: string,
  ) {
    try {
      const response = await fetch(`/api/jobs/${jobId}/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label, matchRunId }),
      });
      if (!response.ok) throw new Error("Could not save feedback.");
      setMessage("Thanks — your relevance signal is saved.");
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : "Could not save feedback.");
    }
  }

  return (
    <div className="product-page">
      <div className="page-intro">
        <div>
          <p className="signal-label">
            <span className="signal-dot" aria-hidden="true" />
            Match intelligence
          </p>
          <h1>A shortlist you can actually audit.</h1>
          <p>
            ResuLens applies hard eligibility constraints first, then combines full-text and vector
            retrieval. Scores are product signals — never hiring decisions.
          </p>
        </div>
        <span className="page-count">ResuLens match scores</span>
      </div>

      <section className="match-controls" aria-labelledby="match-controls-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Control the signal</p>
            <h2 id="match-controls-title" className="match-controls-title">
              Match preferences
            </h2>
          </div>
          <Link href="/dashboard" className="button-secondary">
            Review Resumes
          </Link>
        </div>
        {approvedResumes.length ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-bold text-[var(--muted)]">
              Approved resume
              <select
                name="resume-id"
                className="product-input mt-2 w-full"
                value={resumeId}
                onChange={(event) => {
                  setResumeId(event.target.value);
                  setRun(null);
                }}
                disabled={busy}
              >
                {approvedResumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.original_filename}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-[var(--muted)]">
              Countries (ISO codes)
              <input
                name="country-codes"
                className="product-input mt-2 w-full uppercase"
                value={inputValue(preferences.countryCodes)}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    countryCodes: event.target.value
                      .split(",")
                      .map((value) => value.trim().toUpperCase())
                      .filter(Boolean),
                  }))
                }
                placeholder="e.g. IN, US…"
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <label className="text-xs font-bold text-[var(--muted)]">
              Preferred locations
              <input
                name="preferred-locations"
                className="product-input mt-2 w-full"
                value={inputValue(preferences.preferredLocations)}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    preferredLocations: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  }))
                }
                placeholder="e.g. Bengaluru, Remote…"
                autoComplete="off"
                disabled={busy}
              />
            </label>
            <label className="text-xs font-bold text-[var(--muted)]">
              Workplace
              <select
                name="workplace-type"
                className="product-input mt-2 w-full"
                value={preferences.workplaceTypes[0] ?? ""}
                onChange={(event) =>
                  setPreferences((current) => ({
                    ...current,
                    workplaceTypes: event.target.value ? [event.target.value] : [],
                  }))
                }
                disabled={busy}
              >
                <option value="">Any arrangement</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </label>
          </div>
        ) : (
          <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
            Approve a resume on the dashboard to unlock matching. The matching engine never uses a
            draft profile.
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="button-primary"
            onClick={createRun}
            disabled={busy || !approvedResumes.length}
          >
            {busy ? "Preparing Matches…" : run ? "Refresh Matches" : "Find My Matches"}
          </button>
          <span className="text-xs text-[var(--quiet)]">
            Missing provider data stays unknown and does not lower an otherwise eligible score.
          </span>
        </div>
        {message ? (
          <p className="mt-4 text-sm text-[#ffad9f]" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-[#ff9285]" role="alert">
            {error}
          </p>
        ) : null}
      </section>

      {run ? (
        <section className="mt-10" aria-labelledby="ranked-matches-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">Ranked feed</p>
              <h2
                id="ranked-matches-title"
                className="mt-2 text-2xl font-extrabold text-[var(--foreground)]"
              >
                {run.matches.length
                  ? `${run.matches.length} opportunities worth a look`
                  : "No eligible matches yet"}
              </h2>
            </div>
            <p className="text-xs text-[var(--quiet)]">
              Revision {run.run.resume_profile_version} · preferences {run.run.preferences_revision}{" "}
              · {run.run.scoring_version}
            </p>
            {run.matches.length ? (
              <button
                type="button"
                className="header-link border border-[#8c83ff]/20"
                onClick={() => explainTopMatches(run.run.id)}
                disabled={busy || run.run.explanation_status === "processing"}
              >
                {run.run.explanation_status === "complete" ? "Top 10 explained" : "Explain top 10"}
              </button>
            ) : null}
          </div>
          {run.run.status === "embedding_pending" ? (
            <div
              className="mt-5 rounded-2xl border border-dashed border-white/15 bg-black/20 px-5 py-8 text-sm text-[var(--muted)]"
              role="status"
            >
              Your approved profile is being converted into a private matching signal. This page
              will not display results until the worker finishes.
            </div>
          ) : run.matches.length ? (
            <div className="mt-5 grid gap-4">
              {run.matches.map((match) => {
                const job = match.job;
                if (!job) return null;
                const eligibility = asRecord(match.eligibility);
                const unknowns = asStrings(eligibility?.unknowns);
                const conflicts = asStrings(eligibility?.conflicts);
                const score = Math.round(match.match_score * 100);
                return (
                  <article key={match.id} className="match-card">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="job-source">
                          #{match.rank} · {relatedName(job.companies) ?? "Company not specified"}
                        </p>
                        <h3 className="mt-2 text-xl font-extrabold tracking-tight text-[var(--foreground)]">
                          {job.title}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {job.location_text ?? "Location not specified"} · {job.workplace_type}
                          {job.seniority ? ` · ${job.seniority}` : ""}
                          {relatedName(job.job_sources) ? ` · ${relatedName(job.job_sources)}` : ""}
                        </p>
                      </div>
                      <div className="match-score-badge">
                        <p>{score}</p>
                        <span>ResuLens match score</span>
                      </div>
                    </div>
                    <p className="mt-4 max-w-4xl text-sm leading-7 text-[var(--muted)]">
                      {job.description.slice(0, 420)}
                      {job.description.length > 420 ? "…" : ""}
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      {scoreSignals(match.score_breakdown).map((signal) => (
                        <div
                          key={signal.name}
                          className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                        >
                          <p className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[var(--quiet)]">
                            {signalLabels[signal.name] ?? signal.name}
                          </p>
                          <p className="mt-1 text-sm font-bold text-[var(--foreground)]">
                            {Math.round(signal.value * 100)}%
                          </p>
                        </div>
                      ))}
                    </div>
                    {unknowns.length || conflicts.length ? (
                      <div className="mt-4 rounded-xl border border-[#8c83ff]/20 bg-[#8c83ff]/[0.07] px-4 py-3 text-xs leading-6 text-[#c9c5ff]">
                        {conflicts.length ? (
                          <p>
                            <strong>Confirmed conflicts:</strong> {conflicts.join(" ")}
                          </p>
                        ) : null}
                        {unknowns.length ? (
                          <p>
                            <strong>Still unknown:</strong> {unknowns.join(" ")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {match.explanation?.status === "succeeded" && match.explanation.explanation ? (
                      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm leading-6 text-[var(--muted)]">
                        <p className="font-bold text-[var(--foreground)]">Grounded read</p>
                        {(() => {
                          const explanation = asRecord(match.explanation.explanation);
                          return (
                            <p className="mt-1">
                              {typeof explanation?.summary === "string"
                                ? explanation.summary
                                : "Evidence-backed explanation available."}
                            </p>
                          );
                        })()}
                      </div>
                    ) : match.explanation?.status === "failed" ? (
                      <p className="mt-4 text-xs text-[var(--quiet)]">
                        Explanation unavailable; the deterministic ranked result remains valid.
                      </p>
                    ) : null}
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="header-link border border-white/10"
                      >
                        Details
                      </Link>
                      <a
                        href={job.canonical_url}
                        target="_blank"
                        rel="noreferrer"
                        className="header-link border border-white/10"
                      >
                        Open source
                      </a>
                      <button
                        type="button"
                        className={`header-link border border-white/10 ${match.action === "saved" ? "!text-[#ffad9f]" : ""}`}
                        onClick={() => updateAction(job.id, "saved", run.run.id)}
                        disabled={busy}
                      >
                        {match.action === "saved" ? "Saved" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="header-link border border-white/10"
                        onClick={() => updateAction(job.id, "dismissed", run.run.id)}
                        disabled={busy}
                      >
                        {match.action === "dismissed" ? "Dismissed" : "Dismiss"}
                      </button>
                      <button
                        type="button"
                        className="header-link border border-white/10"
                        onClick={() => updateAction(job.id, "applied", run.run.id)}
                        disabled={busy}
                      >
                        {match.action === "applied" ? "Marked applied" : "Mark applied"}
                      </button>
                      {!match.explanation || match.explanation.status === "pending" ? (
                        <button
                          type="button"
                          className="header-link border border-[#8c83ff]/20"
                          onClick={() => explain(match.id, run.run.id)}
                          disabled={busy}
                        >
                          Explain
                        </button>
                      ) : null}
                      <span className="ml-auto flex items-center gap-1 text-xs text-[var(--quiet)]">
                        <button
                          type="button"
                          className="px-2 py-1 hover:text-[var(--foreground)]"
                          onClick={() => sendFeedback(job.id, "relevant", run.run.id)}
                          aria-label="Mark this match relevant"
                        >
                          Useful
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 hover:text-[var(--foreground)]"
                          onClick={() => sendFeedback(job.id, "not_relevant", run.run.id)}
                          aria-label="Mark this match not relevant"
                        >
                          Not useful
                        </button>
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-black/20 px-5 py-10 text-sm leading-6 text-[var(--muted)]">
              No active listing satisfied the current hard constraints. Try widening your country,
              workplace, or location filters; unknown provider fields are never treated as confirmed
              eligibility.
            </div>
          )}
        </section>
      ) : (
        <section className="mt-10 rounded-2xl border border-dashed border-white/15 bg-black/20 px-5 py-10 text-center">
          <p className="text-lg font-bold text-[var(--foreground)]">Your ranked feed is waiting.</p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--muted)]">
            Start a run after approving a resume. Results are versioned to that approved profile and
            the preferences shown above.
          </p>
        </section>
      )}
    </div>
  );
}
