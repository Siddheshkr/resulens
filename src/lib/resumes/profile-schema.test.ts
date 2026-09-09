import { describe, expect, it } from "vitest";

import {
  calculateAverageConfidence,
  emptyResumeProfile,
  resumeProfileSchema,
} from "@/lib/resumes/profile-schema";

describe("resume profile contract", () => {
  it("accepts a bounded synthetic profile and computes confidence", () => {
    const profile = resumeProfileSchema.parse({
      ...emptyResumeProfile,
      fullName: "Synthetic Candidate",
      headline: "Software engineer",
      skills: [
        {
          name: "TypeScript",
          category: "language",
          evidence: [{ page: 1, excerpt: "TypeScript" }],
          confidence: 0.9,
        },
      ],
    });

    expect(profile.fullName).toBe("Synthetic Candidate");
    expect(calculateAverageConfidence(profile)).toBe(0.9);
  });

  it("rejects unsupported evidence page numbers and unbounded excerpts", () => {
    const result = resumeProfileSchema.safeParse({
      ...emptyResumeProfile,
      skills: [
        {
          name: "TypeScript",
          category: null,
          evidence: [{ page: 6, excerpt: "x".repeat(501) }],
          confidence: 0.9,
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
