import { describe, expect, it } from "vitest";

import { emptyResumeProfile } from "@/lib/resumes/profile-schema";
import { evaluateEligibility } from "@/server/matching/eligibility";
import type { MatchingJob } from "@/server/matching/content";
import type { MatchingPreferences } from "@/server/matching/eligibility";

const preferences: MatchingPreferences = {
  country_codes: ["IN"],
  preferred_locations: [],
  workplace_types: ["remote"],
  role_exclusions: ["intern"],
  minimum_experience_years: null,
  maximum_experience_years: null,
  salary_minimum: null,
  salary_currency: null,
  work_authorization_status: "needs_sponsorship",
  revision: 1,
};

const job: MatchingJob = {
  id: "00000000-0000-0000-0000-000000000002",
  status: "active",
  title: "Platform Engineer",
  description: "Operate distributed systems.",
  location_text: "Remote",
  country_code: "IN",
  workplace_type: "remote",
  employment_type: "full-time",
  seniority: "senior",
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  work_authorization_support: "unknown",
  required_experience_min_years: 4,
  required_experience_max_years: null,
  content_fingerprint: "b".repeat(64),
  posted_at: null,
  source_updated_at: null,
};

describe("matching eligibility", () => {
  it("keeps missing authorization and experience data as unknown", () => {
    const result = evaluateEligibility(
      { ...emptyResumeProfile, totalExperienceYears: null },
      preferences,
      job,
    );
    expect(result.hardEligible).toBe(true);
    expect(result.conflicts).toEqual([]);
    expect(result.unknowns).toEqual(
      expect.arrayContaining([
        "The posting does not state its work-authorization support.",
        "The approved profile does not state total experience.",
      ]),
    );
  });

  it("removes confirmed hard conflicts before scoring", () => {
    const result = evaluateEligibility(
      { ...emptyResumeProfile, totalExperienceYears: 2 },
      preferences,
      { ...job, work_authorization_support: "no_sponsorship" },
    );
    expect(result.hardEligible).toBe(false);
    expect(result.conflicts).toEqual(
      expect.arrayContaining([
        "The posting states that sponsorship is not supported.",
        "The stated experience requirement exceeds the approved profile.",
      ]),
    );
  });

  it("enforces an explicitly selected experience range", () => {
    const result = evaluateEligibility(
      { ...emptyResumeProfile, totalExperienceYears: 6 },
      { ...preferences, minimum_experience_years: 5, maximum_experience_years: 8 },
      { ...job, required_experience_min_years: 10 },
    );
    expect(result.hardEligible).toBe(false);
    expect(result.conflicts).toContain("The role is above your selected maximum experience range.");
  });
});
