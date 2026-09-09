import type { ResumeProfile } from "@/lib/resumes/profile-schema";

import type { MatchingJob } from "@/server/matching/content";

export type MatchingPreferences = {
  country_codes: string[];
  preferred_locations: string[];
  workplace_types: string[];
  role_exclusions: string[];
  minimum_experience_years: number | null;
  maximum_experience_years: number | null;
  salary_minimum: number | null;
  salary_currency: string | null;
  work_authorization_status: "authorized" | "needs_sponsorship" | "unknown";
  revision: number;
};

export type EligibilityResult = {
  status: "eligible" | "unknown" | "conflict";
  hardEligible: boolean;
  conflicts: string[];
  unknowns: string[];
};

function includesInsensitive(values: string[], value: string | null) {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return values.some((candidate) => normalized.includes(candidate.toLowerCase()));
}

export function evaluateEligibility(
  profile: ResumeProfile,
  preferences: MatchingPreferences,
  job: MatchingJob,
): EligibilityResult {
  const conflicts: string[] = [];
  const unknowns: string[] = [];

  if (job.status !== "active") conflicts.push("This listing is no longer active.");

  if (preferences.country_codes.length > 0) {
    if (!job.country_code) unknowns.push("The job country is not specified.");
    else if (!preferences.country_codes.includes(job.country_code)) {
      conflicts.push("The job country is outside your selected countries.");
    }
  }

  if (preferences.workplace_types.length > 0) {
    if (job.workplace_type === "unknown")
      unknowns.push("The workplace arrangement is not specified.");
    else if (!preferences.workplace_types.includes(job.workplace_type)) {
      conflicts.push("The workplace arrangement does not match your preference.");
    }
  }

  const roleText = `${job.title} ${job.description}`.toLowerCase();
  for (const excludedRole of preferences.role_exclusions) {
    if (excludedRole && roleText.includes(excludedRole.toLowerCase())) {
      conflicts.push(`The posting contains an excluded role term: ${excludedRole}.`);
    }
  }

  if (
    preferences.work_authorization_status === "needs_sponsorship" &&
    job.work_authorization_support === "no_sponsorship"
  ) {
    conflicts.push("The posting states that sponsorship is not supported.");
  } else if (
    preferences.work_authorization_status !== "unknown" &&
    job.work_authorization_support === "unknown"
  ) {
    unknowns.push("The posting does not state its work-authorization support.");
  }

  if (job.required_experience_min_years !== null) {
    if (
      profile.totalExperienceYears !== null &&
      profile.totalExperienceYears < job.required_experience_min_years
    ) {
      conflicts.push("The stated experience requirement exceeds the approved profile.");
    } else if (profile.totalExperienceYears === null) {
      unknowns.push("The approved profile does not state total experience.");
    }
    if (
      preferences.minimum_experience_years !== null &&
      job.required_experience_min_years < preferences.minimum_experience_years
    ) {
      conflicts.push("The role is below your selected minimum experience range.");
    }
    if (
      preferences.maximum_experience_years !== null &&
      job.required_experience_min_years > preferences.maximum_experience_years
    ) {
      conflicts.push("The role is above your selected maximum experience range.");
    }
  } else if (
    preferences.minimum_experience_years !== null ||
    preferences.maximum_experience_years !== null
  ) {
    unknowns.push("Required experience is not specified.");
  }

  if (job.location_text === null && preferences.preferred_locations.length > 0) {
    unknowns.push("The job location is not specified.");
  }

  if (
    preferences.preferred_locations.length > 0 &&
    job.location_text !== null &&
    !includesInsensitive(preferences.preferred_locations, job.location_text)
  ) {
    if (job.workplace_type === "remote") {
      unknowns.push("The remote posting does not confirm your preferred location.");
    } else {
      conflicts.push("The listed location does not match a preferred location.");
    }
  }

  return {
    status: conflicts.length > 0 ? "conflict" : unknowns.length > 0 ? "unknown" : "eligible",
    hardEligible: conflicts.length === 0,
    conflicts,
    unknowns,
  };
}
