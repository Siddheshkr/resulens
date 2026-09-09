import { describe, expect, it } from "vitest";

import { emptyResumeProfile } from "@/lib/resumes/profile-schema";
import {
  calculateRoleSeniorityFit,
  calculateSkillOverlap,
  scoreMatch,
} from "@/server/matching/scoring";
import type { MatchingJob } from "@/server/matching/content";
import type { MatchingPreferences } from "@/server/matching/eligibility";

const preferences: MatchingPreferences = {
  country_codes: ["IN"],
  preferred_locations: [],
  workplace_types: ["remote"],
  role_exclusions: [],
  minimum_experience_years: null,
  maximum_experience_years: null,
  salary_minimum: null,
  salary_currency: null,
  work_authorization_status: "unknown",
  revision: 1,
};

const job: MatchingJob = {
  id: "00000000-0000-0000-0000-000000000001",
  status: "active",
  title: "Senior TypeScript Engineer",
  description: "Build services.",
  location_text: "Remote",
  country_code: "IN",
  workplace_type: "remote",
  employment_type: "full-time",
  seniority: "senior",
  salary_min: null,
  salary_max: null,
  salary_currency: null,
  work_authorization_support: "unknown",
  required_experience_min_years: null,
  required_experience_max_years: null,
  content_fingerprint: "a".repeat(64),
  posted_at: "2026-09-10T00:00:00.000Z",
  source_updated_at: null,
};

describe("deterministic matching score", () => {
  it("renormalizes weights when optional signals are unavailable", () => {
    const full = scoreMatch({
      semanticSimilarity: 1,
      skills: 0.8,
      roleSeniority: 0.6,
      location: 1,
      freshness: 1,
      salary: null,
    });
    const expected = (0.4 + 0.8 * 0.25 + 0.6 * 0.15 + 1 * 0.1 + 1 * 0.05) / 0.95;
    expect(full.availableWeight).toBeCloseTo(0.95);
    expect(full.score).toBeCloseTo(expected, 5);
    expect(full.signals.salary.appliedWeight).toBe(0);
  });

  it("keeps skill and role signals reproducible", () => {
    const profile = {
      ...emptyResumeProfile,
      roleFamilies: ["Software Engineer"],
      seniority: "senior" as const,
      skills: [
        { name: "TypeScript", category: null, evidence: [], confidence: 1 },
        { name: "React", category: null, evidence: [], confidence: 1 },
      ],
    };
    expect(calculateSkillOverlap(profile, ["TypeScript", "React", "Python"])).toBeCloseTo(2 / 3);
    expect(calculateRoleSeniorityFit(profile, job)).toBeGreaterThan(0.5);
    expect(scoreMatch({ semanticSimilarity: 0.7, skills: 0.8 })).toEqual(
      scoreMatch({ semanticSimilarity: 0.7, skills: 0.8 }),
    );
    expect(preferences.revision).toBe(1);
  });
});
