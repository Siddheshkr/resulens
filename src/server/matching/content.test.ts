import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { emptyResumeProfile } from "@/lib/resumes/profile-schema";
import { buildResumeEmbeddingContent } from "@/server/matching/content";

describe("resume embedding content", () => {
  it("excludes contact details and evidence excerpts", () => {
    const content = buildResumeEmbeddingContent({
      ...emptyResumeProfile,
      fullName: "Synthetic Candidate",
      email: "candidate@example.test",
      phone: "+91 555 0100",
      headline: "Platform engineer",
      skills: [
        {
          name: "TypeScript",
          category: "language",
          evidence: [{ page: 1, excerpt: "private contact context" }],
          confidence: 1,
        },
      ],
    });
    expect(content).toContain("Platform engineer");
    expect(content).toContain("TypeScript");
    expect(content).not.toContain("Synthetic Candidate");
    expect(content).not.toContain("candidate@example.test");
    expect(content).not.toContain("555 0100");
    expect(content).not.toContain("private contact context");
  });
});
