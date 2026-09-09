import type { ResumeProfile } from "@/lib/resumes/profile-schema";

import type { MatchingJob } from "@/server/matching/content";
import type { MatchingPreferences } from "@/server/matching/eligibility";

export const MATCH_SCORE_WEIGHTS = {
  semanticSimilarity: 0.4,
  skills: 0.25,
  roleSeniority: 0.15,
  location: 0.1,
  freshness: 0.05,
  salary: 0.05,
} as const;

export type MatchSignalName = keyof typeof MATCH_SCORE_WEIGHTS;

export type MatchSignals = Partial<Record<MatchSignalName, number | null>>;

export type ScoreBreakdown = {
  signals: Record<
    MatchSignalName,
    { value: number | null; baseWeight: number; appliedWeight: number }
  >;
  availableWeight: number;
  score: number;
};

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/gu, " ")
    .trim();
}

function tokenSet(value: string) {
  return new Set(normalize(value).split(/\s+/u).filter(Boolean));
}

function overlap(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return null;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / Math.max(left.size, right.size);
}

export function calculateSkillOverlap(profile: ResumeProfile, jobSkills: string[]) {
  if (jobSkills.length === 0 || profile.skills.length === 0) return null;
  const profileSkills = new Set(profile.skills.map((skill) => normalize(skill.name)));
  const requiredSkills = new Set(jobSkills.map(normalize));
  let matched = 0;
  for (const skill of requiredSkills) {
    if (
      [...profileSkills].some(
        (candidate) =>
          candidate === skill || candidate.includes(skill) || skill.includes(candidate),
      )
    ) {
      matched += 1;
    }
  }
  return matched / requiredSkills.size;
}

export function calculateRoleSeniorityFit(profile: ResumeProfile, job: MatchingJob) {
  const roleTokens = new Set(profile.roleFamilies.flatMap((role) => [...tokenSet(role)]));
  const titleTokens = tokenSet(job.title);
  const roleFit = overlap(roleTokens, titleTokens);
  const profileSeniority = profile.seniority;
  const jobSeniority = job.seniority?.toLowerCase() ?? null;
  const seniorityFit =
    !jobSeniority || profileSeniority === "unknown"
      ? null
      : jobSeniority.includes(profileSeniority) || profileSeniority.includes(jobSeniority)
        ? 1
        : 0.35;

  if (roleFit === null && seniorityFit === null) return null;
  if (roleFit === null) return seniorityFit;
  if (seniorityFit === null) return roleFit;
  return clamp(roleFit * 0.65 + seniorityFit * 0.35);
}

export function calculateLocationFit(preferences: MatchingPreferences, job: MatchingJob) {
  const hasCountryPreference = preferences.country_codes.length > 0;
  const hasWorkplacePreference = preferences.workplace_types.length > 0;
  if (!hasCountryPreference && !hasWorkplacePreference) return null;

  const values: number[] = [];
  if (hasCountryPreference) {
    if (!job.country_code) return null;
    values.push(preferences.country_codes.includes(job.country_code) ? 1 : 0);
  }
  if (hasWorkplacePreference) {
    if (job.workplace_type === "unknown") return null;
    values.push(preferences.workplace_types.includes(job.workplace_type) ? 1 : 0);
  }
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

export function calculateFreshness(job: MatchingJob, now = Date.now()) {
  const date = job.posted_at ?? job.source_updated_at;
  if (!date) return null;
  const ageDays = Math.max(0, (now - new Date(date).getTime()) / 86_400_000);
  return clamp(1 - ageDays / 90);
}

export function calculateSalaryFit(preferences: MatchingPreferences, job: MatchingJob) {
  if (preferences.salary_minimum === null || job.salary_min === null) return null;
  if (
    preferences.salary_currency &&
    job.salary_currency &&
    preferences.salary_currency !== job.salary_currency
  ) {
    return null;
  }
  if (job.salary_max !== null && job.salary_max >= preferences.salary_minimum) return 1;
  return clamp(job.salary_min / Math.max(preferences.salary_minimum, 1));
}

export function scoreMatch(signals: MatchSignals): ScoreBreakdown {
  const entries = (Object.keys(MATCH_SCORE_WEIGHTS) as MatchSignalName[]).map((name) => ({
    name,
    value:
      signals[name] === null || signals[name] === undefined ? null : clamp(signals[name] as number),
    baseWeight: MATCH_SCORE_WEIGHTS[name],
  }));
  const availableWeight = entries.reduce(
    (total, entry) => total + (entry.value === null ? 0 : entry.baseWeight),
    0,
  );
  const normalizedWeight = availableWeight > 0 ? availableWeight : 1;
  const signalRecord = {} as ScoreBreakdown["signals"];
  let score = 0;

  for (const entry of entries) {
    const appliedWeight = entry.value === null ? 0 : entry.baseWeight / normalizedWeight;
    signalRecord[entry.name] = {
      value: entry.value,
      baseWeight: entry.baseWeight,
      appliedWeight,
    };
    score += (entry.value ?? 0) * appliedWeight;
  }

  return {
    signals: signalRecord,
    availableWeight,
    score: Number(score.toFixed(5)),
  };
}
