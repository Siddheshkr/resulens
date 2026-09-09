import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resumeProfileSchema, type ResumeProfile } from "@/lib/resumes/profile-schema";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables, TablesInsert } from "@/lib/supabase/database.types";
import { enqueueResumeEmbedding, ensureCandidatePreferences } from "@/server/matching/queue";
import {
  buildResumeEmbeddingContent,
  sha256Text,
  type MatchingJob,
} from "@/server/matching/content";
import {
  getEmbeddingModel,
  MATCHING_SCORING_VERSION,
  MAX_MATCH_CANDIDATES,
  MAX_MATCH_RESULTS,
} from "@/server/matching/constants";
import { evaluateEligibility, type MatchingPreferences } from "@/server/matching/eligibility";
import {
  calculateFreshness,
  calculateLocationFit,
  calculateRoleSeniorityFit,
  calculateSalaryFit,
  calculateSkillOverlap,
  scoreMatch,
} from "@/server/matching/scoring";
import type { PreferencesInput } from "@/server/matching/requests";

type AdminClient = SupabaseClient<Database>;

type ApprovedResume = {
  id: string;
  status: string;
  approved_profile_version: number | null;
  profile: ResumeProfile;
};

type CandidateRow = {
  job_posting_id: string;
  lexical_score: number | null;
  semantic_score: number | null;
  retrieval_source: string;
};

type ScoringJob = MatchingJob & {
  country_code: string | null;
};

function asJson(value: unknown): Json {
  return value as Json;
}

type CandidatePreferencesRow = Pick<
  Tables<"candidate_preferences">,
  | "country_codes"
  | "preferred_locations"
  | "workplace_types"
  | "role_exclusions"
  | "minimum_experience_years"
  | "maximum_experience_years"
  | "salary_minimum"
  | "salary_currency"
  | "work_authorization_status"
  | "revision"
>;

function preferencesFromRow(row: CandidatePreferencesRow): MatchingPreferences {
  return {
    country_codes: row.country_codes,
    preferred_locations: row.preferred_locations,
    workplace_types: row.workplace_types,
    role_exclusions: row.role_exclusions,
    minimum_experience_years: row.minimum_experience_years,
    maximum_experience_years: row.maximum_experience_years,
    salary_minimum: row.salary_minimum,
    salary_currency: row.salary_currency,
    work_authorization_status:
      row.work_authorization_status as MatchingPreferences["work_authorization_status"],
    revision: row.revision,
  };
}

function queryText(profile: ResumeProfile) {
  return [profile.headline, ...profile.roleFamilies, ...profile.skills.map((skill) => skill.name)]
    .filter(Boolean)
    .join(" ")
    .slice(0, 500);
}

async function loadApprovedResume(admin: AdminClient, userId: string, resumeId: string) {
  const { data: resume, error: resumeError } = await admin
    .from("resumes")
    .select("id,status,approved_profile_version")
    .eq("id", resumeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (resumeError) throw new Error("Could not load the resume for matching");
  if (!resume) return null;
  if (resume.status !== "approved" || resume.approved_profile_version === null) {
    throw new Error("Approve this resume before creating matches");
  }
  const { data: profile, error: profileError } = await admin
    .from("resume_profiles")
    .select("profile,status,version")
    .eq("resume_id", resume.id)
    .eq("user_id", userId)
    .eq("version", resume.approved_profile_version)
    .eq("status", "approved")
    .maybeSingle();
  if (profileError || !profile) throw new Error("Could not load the approved profile");
  const parsed = resumeProfileSchema.safeParse(profile.profile);
  if (!parsed.success) throw new Error("The approved profile is invalid");
  return {
    id: resume.id,
    status: resume.status,
    approved_profile_version: resume.approved_profile_version,
    profile: parsed.data,
  } satisfies ApprovedResume;
}

async function loadResumeEmbedding(admin: AdminClient, resume: ApprovedResume) {
  const { data, error } = await admin
    .from("resume_embeddings")
    .select("id,embedding,model,profile_version,content_hash")
    .eq("resume_id", resume.id)
    .eq("profile_version", resume.approved_profile_version as number)
    .eq("model", getEmbeddingModel())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not load the resume matching signal");
  return data;
}

function normalizeCandidateRows(value: unknown): CandidateRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const row = candidate as Record<string, unknown>;
    if (typeof row.job_posting_id !== "string" || typeof row.retrieval_source !== "string")
      return [];
    return [
      {
        job_posting_id: row.job_posting_id,
        lexical_score: typeof row.lexical_score === "number" ? row.lexical_score : null,
        semantic_score: typeof row.semantic_score === "number" ? row.semantic_score : null,
        retrieval_source: row.retrieval_source,
      },
    ];
  });
}

export type MatchRunResult = {
  runId: string;
  status: "embedding_pending" | "succeeded" | "partial" | "failed";
  candidateCount: number;
  profileVersion: number;
  preferencesRevision: number;
};

export async function createMatchRun(
  userId: string,
  resumeId: string,
  preferencePatch?: Partial<PreferencesInput>,
): Promise<MatchRunResult> {
  const admin = createAdminSupabaseClient();
  const resume = await loadApprovedResume(admin, userId, resumeId);
  if (!resume) throw new Error("Resume not found");
  const storedPreferences = preferencesFromRow(await ensureCandidatePreferences(admin, userId));
  const effectivePreferences: MatchingPreferences = preferencePatch
    ? await saveCandidatePreferences(userId, preferencePatch)
    : storedPreferences;

  const sourcePendingHash = sha256Text(
    `${resume.id}:${resume.approved_profile_version}:${effectivePreferences.revision}:pending`,
  );
  const embedding = await loadResumeEmbedding(admin, resume);
  if (!embedding) {
    const { data: existingPending, error: pendingError } = await admin
      .from("match_runs")
      .select("id")
      .eq("user_id", userId)
      .eq("resume_id", resume.id)
      .eq("resume_profile_version", resume.approved_profile_version as number)
      .eq("preferences_revision", effectivePreferences.revision)
      .eq("scoring_version", MATCHING_SCORING_VERSION)
      .eq("status", "embedding_pending")
      .maybeSingle();
    if (pendingError) throw new Error("Could not check the matching run");
    const pendingRun =
      existingPending ??
      (
        await admin
          .from("match_runs")
          .insert({
            user_id: userId,
            resume_id: resume.id,
            resume_profile_version: resume.approved_profile_version as number,
            preferences_revision: effectivePreferences.revision,
            scoring_version: MATCHING_SCORING_VERSION,
            embedding_model: getEmbeddingModel(),
            source_snapshot_hash: sourcePendingHash,
            status: "embedding_pending",
            filter_snapshot: asJson(effectivePreferences),
          })
          .select("id")
          .single()
      ).data;
    if (!pendingRun) throw new Error("Could not create the matching run");
    await enqueueResumeEmbedding(
      admin,
      resume.id,
      userId,
      resume.approved_profile_version as number,
    );
    return {
      runId: pendingRun.id,
      status: "embedding_pending",
      candidateCount: 0,
      profileVersion: resume.approved_profile_version as number,
      preferencesRevision: effectivePreferences.revision,
    };
  }

  const { data: retrieved, error: retrievalError } = await admin.rpc("search_job_candidates", {
    p_resume_embedding: embedding.embedding,
    p_query: queryText(resume.profile),
    p_country_codes: effectivePreferences.country_codes,
    p_workplace_types: effectivePreferences.workplace_types,
    p_role_exclusions: effectivePreferences.role_exclusions,
    p_limit: MAX_MATCH_CANDIDATES,
  });
  if (retrievalError) throw new Error("Could not retrieve matching jobs");
  const candidates = normalizeCandidateRows(retrieved);
  const candidateIds = candidates.map((candidate) => candidate.job_posting_id);
  const jobsById = new Map<string, ScoringJob>();
  if (candidateIds.length > 0) {
    const { data: jobs, error: jobsError } = await admin
      .from("job_postings")
      .select(
        "id,status,title,description,location_text,country_code,workplace_type,employment_type,seniority,salary_min,salary_max,salary_currency,work_authorization_support,required_experience_min_years,required_experience_max_years,content_fingerprint,posted_at,source_updated_at",
      )
      .in("id", candidateIds);
    if (jobsError) throw new Error("Could not load matching jobs");
    for (const job of jobs ?? []) jobsById.set(job.id, job as ScoringJob);
  }

  const skillsByJob = new Map<string, string[]>();
  if (candidateIds.length > 0) {
    const { data: skillRows } = await admin
      .from("job_skills")
      .select("job_posting_id,display_skill")
      .in("job_posting_id", candidateIds);
    for (const row of skillRows ?? []) {
      const skills = skillsByJob.get(row.job_posting_id) ?? [];
      skills.push(row.display_skill);
      skillsByJob.set(row.job_posting_id, skills);
    }
  }

  const scored = candidates.flatMap((candidate) => {
    const job = jobsById.get(candidate.job_posting_id);
    if (!job) return [];
    const eligibility = evaluateEligibility(resume.profile, effectivePreferences, job);
    if (!eligibility.hardEligible) return [];
    const signals = {
      semanticSimilarity: candidate.semantic_score,
      skills: calculateSkillOverlap(resume.profile, skillsByJob.get(job.id) ?? []),
      roleSeniority: calculateRoleSeniorityFit(resume.profile, job),
      location: calculateLocationFit(effectivePreferences, job),
      freshness: calculateFreshness(job),
      salary: calculateSalaryFit(effectivePreferences, job),
    };
    const breakdown = scoreMatch(signals);
    return [
      {
        job,
        candidate,
        eligibility,
        breakdown,
        evidence: {
          retrievalSource: candidate.retrieval_source,
          matchedSkills: skillsByJob.get(job.id) ?? [],
          unknowns: eligibility.unknowns,
          conflicts: eligibility.conflicts,
        },
      },
    ];
  });
  scored.sort(
    (left, right) =>
      right.breakdown.score - left.breakdown.score || left.job.id.localeCompare(right.job.id),
  );
  const selected = scored.slice(0, MAX_MATCH_RESULTS);
  const sourceSnapshotHash = sha256Text(
    selected
      .map((item) => `${item.job.id}:${item.job.content_fingerprint}`)
      .sort()
      .join("|"),
  );

  const { data: pendingRun, error: pendingRunError } = await admin
    .from("match_runs")
    .select("id")
    .eq("user_id", userId)
    .eq("resume_id", resume.id)
    .eq("resume_profile_version", resume.approved_profile_version as number)
    .eq("preferences_revision", effectivePreferences.revision)
    .eq("scoring_version", MATCHING_SCORING_VERSION)
    .eq("status", "embedding_pending")
    .maybeSingle();
  if (pendingRunError) throw new Error("Could not check the pending matching run");

  let runId: string;
  if (pendingRun) {
    const { error: updateError } = await admin
      .from("match_runs")
      .update({
        embedding_model: embedding.model,
        source_snapshot_hash: sourceSnapshotHash,
        status: "succeeded",
        candidate_count: selected.length,
        filter_snapshot: asJson(effectivePreferences),
        completed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
      })
      .eq("id", pendingRun.id)
      .eq("user_id", userId);
    if (updateError) throw new Error("Could not complete the matching run");
    runId = pendingRun.id;
  } else {
    const { data: run, error: runError } = await admin
      .from("match_runs")
      .insert({
        user_id: userId,
        resume_id: resume.id,
        resume_profile_version: resume.approved_profile_version as number,
        preferences_revision: effectivePreferences.revision,
        scoring_version: MATCHING_SCORING_VERSION,
        embedding_model: embedding.model,
        source_snapshot_hash: sourceSnapshotHash,
        status: "succeeded",
        candidate_count: selected.length,
        filter_snapshot: asJson(effectivePreferences),
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (runError || !run) throw new Error("Could not save the matching run");
    runId = run.id;
  }

  if (selected.length > 0) {
    const matches: TablesInsert<"job_matches">[] = selected.map((item, index) => ({
      match_run_id: runId,
      user_id: userId,
      job_posting_id: item.job.id,
      rank: index + 1,
      match_score: item.breakdown.score,
      lexical_score: item.candidate.lexical_score,
      semantic_score: item.candidate.semantic_score,
      score_breakdown: asJson(item.breakdown),
      eligibility: asJson(item.eligibility),
      evidence: asJson(item.evidence),
      job_content_fingerprint: item.job.content_fingerprint,
      embedding_model: embedding.model,
    }));
    const { error: matchError } = await admin.from("job_matches").insert(matches);
    if (matchError) throw new Error("Could not save matching results");
  }

  return {
    runId,
    status: "succeeded",
    candidateCount: selected.length,
    profileVersion: resume.approved_profile_version as number,
    preferencesRevision: effectivePreferences.revision,
  };
}

export async function getMatchRun(userId: string, runId: string) {
  const admin = createAdminSupabaseClient();
  const { data: run, error: runError } = await admin
    .from("match_runs")
    .select("*")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (runError) throw new Error("Could not load the match run");
  if (!run) return null;

  const { data: matches, error: matchesError } = await admin
    .from("job_matches")
    .select("*")
    .eq("match_run_id", runId)
    .eq("user_id", userId)
    .order("rank", { ascending: true });
  if (matchesError) throw new Error("Could not load match results");
  const jobIds = (matches ?? []).map((match) => match.job_posting_id);
  const [jobsResult, actionsResult, explanationsResult] = await Promise.all([
    jobIds.length
      ? admin
          .from("job_postings")
          .select(
            "id,title,description,location_text,country_code,workplace_type,employment_type,seniority,canonical_url,posted_at,source_updated_at,content_fingerprint,companies(display_name),job_sources(provider,display_name)",
          )
          .in("id", jobIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? admin
          .from("job_actions")
          .select("job_posting_id,state")
          .eq("user_id", userId)
          .in("job_posting_id", jobIds)
      : Promise.resolve({ data: [], error: null }),
    jobIds.length
      ? admin
          .from("job_match_explanations")
          .select("job_match_id,status,explanation,error_message")
          .eq("user_id", userId)
          .in(
            "job_match_id",
            (matches ?? []).map((match) => match.id),
          )
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (jobsResult.error || actionsResult.error || explanationsResult.error) {
    throw new Error("Could not load match details");
  }
  const jobs = new Map((jobsResult.data ?? []).map((job) => [job.id, job]));
  const actions = new Map(
    (actionsResult.data ?? []).map((action) => [action.job_posting_id, action.state]),
  );
  const explanations = new Map(
    (explanationsResult.data ?? []).map((explanation) => [explanation.job_match_id, explanation]),
  );

  return {
    run,
    matches: (matches ?? []).map((match) => ({
      ...match,
      job: jobs.get(match.job_posting_id) ?? null,
      action: actions.get(match.job_posting_id) ?? null,
      explanation: explanations.get(match.id) ?? null,
    })),
  };
}

export async function getLatestMatchRun(userId: string, resumeId?: string) {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("match_runs")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (resumeId) query = query.eq("resume_id", resumeId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error("Could not load the latest match run");
  return data ? getMatchRun(userId, data.id) : null;
}

export async function saveJobAction(
  userId: string,
  jobPostingId: string,
  state: "saved" | "dismissed" | "applied",
  matchRunId?: string,
) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("job_actions")
    .upsert(
      { user_id: userId, job_posting_id: jobPostingId, state, match_run_id: matchRunId ?? null },
      { onConflict: "user_id,job_posting_id" },
    )
    .select("id,job_posting_id,state,match_run_id,updated_at")
    .single();
  if (error || !data) throw new Error("Could not save the job action");
  return data;
}

export async function deleteJobAction(userId: string, jobPostingId: string) {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("job_actions")
    .delete()
    .eq("user_id", userId)
    .eq("job_posting_id", jobPostingId);
  if (error) throw new Error("Could not clear the job action");
}

export async function saveJobFeedback(
  userId: string,
  jobPostingId: string,
  label: "relevant" | "not_relevant",
  note?: string,
  matchRunId?: string,
) {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("job_feedback")
    .upsert(
      {
        user_id: userId,
        job_posting_id: jobPostingId,
        label,
        note: note ?? null,
        match_run_id: matchRunId ?? null,
      },
      { onConflict: "user_id,job_posting_id" },
    )
    .select("id,job_posting_id,label,note,updated_at")
    .single();
  if (error || !data) throw new Error("Could not save job feedback");
  return data;
}

export async function getCandidatePreferences(userId: string) {
  const admin = createAdminSupabaseClient();
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (profileError) throw new Error("Could not initialize the account profile");
  return preferencesFromRow(await ensureCandidatePreferences(admin, userId));
}

export async function saveCandidatePreferences(userId: string, input: Partial<PreferencesInput>) {
  const admin = createAdminSupabaseClient();
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" });
  if (profileError) throw new Error("Could not initialize the account profile");
  const current = await ensureCandidatePreferences(admin, userId);
  const update: TablesInsert<"candidate_preferences"> = {
    user_id: userId,
    country_codes: input.countryCodes !== undefined ? input.countryCodes : current.country_codes,
    preferred_locations:
      input.preferredLocations !== undefined
        ? input.preferredLocations
        : current.preferred_locations,
    workplace_types:
      input.workplaceTypes !== undefined ? input.workplaceTypes : current.workplace_types,
    role_exclusions:
      input.roleExclusions !== undefined ? input.roleExclusions : current.role_exclusions,
    minimum_experience_years:
      input.minimumExperienceYears !== undefined
        ? input.minimumExperienceYears
        : current.minimum_experience_years,
    maximum_experience_years:
      input.maximumExperienceYears !== undefined
        ? input.maximumExperienceYears
        : current.maximum_experience_years,
    salary_minimum:
      input.salaryMinimum !== undefined ? input.salaryMinimum : current.salary_minimum,
    salary_currency:
      input.salaryCurrency !== undefined ? input.salaryCurrency : current.salary_currency,
    work_authorization_status:
      input.workAuthorizationStatus !== undefined
        ? input.workAuthorizationStatus
        : current.work_authorization_status,
  };
  const unchanged =
    JSON.stringify(update.country_codes) === JSON.stringify(current.country_codes) &&
    JSON.stringify(update.preferred_locations) === JSON.stringify(current.preferred_locations) &&
    JSON.stringify(update.workplace_types) === JSON.stringify(current.workplace_types) &&
    JSON.stringify(update.role_exclusions) === JSON.stringify(current.role_exclusions) &&
    update.minimum_experience_years === current.minimum_experience_years &&
    update.maximum_experience_years === current.maximum_experience_years &&
    update.salary_minimum === current.salary_minimum &&
    update.salary_currency === current.salary_currency &&
    update.work_authorization_status === current.work_authorization_status;
  if (unchanged) return preferencesFromRow(current);
  const { data, error } = await admin
    .from("candidate_preferences")
    .update(update)
    .eq("user_id", userId)
    .select(
      "user_id,revision,country_codes,preferred_locations,workplace_types,role_exclusions,minimum_experience_years,maximum_experience_years,salary_minimum,salary_currency,work_authorization_status",
    )
    .single();
  if (error || !data) throw new Error("Could not save matching preferences");
  return preferencesFromRow(data);
}

export function resumeEmbeddingContentHash(profile: ResumeProfile) {
  return sha256Text(buildResumeEmbeddingContent(profile));
}
