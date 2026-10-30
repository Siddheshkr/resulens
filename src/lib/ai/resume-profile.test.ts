import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getResumeModel } from "@/lib/ai/resume-profile";
import { DEFAULT_RESUME_MODEL } from "@/lib/resumes/constants";

describe("getResumeModel", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to the pinned single-model extraction configuration", () => {
    vi.stubEnv("OPENAI_RESUME_MODEL", "");
    expect(DEFAULT_RESUME_MODEL).toBe("gpt-6-luna");
    expect(getResumeModel()).toBe("gpt-6-luna");
  });

  it("keeps an environment override available for rollback", () => {
    vi.stubEnv("OPENAI_RESUME_MODEL", "rollback-model");
    expect(getResumeModel()).toBe("rollback-model");
  });

  it("ignores a leftover escalation-model variable", () => {
    vi.stubEnv("OPENAI_RESUME_MODEL", "");
    vi.stubEnv("OPENAI_RESUME_ESCALATION_MODEL", "retired-escalation-model");
    expect(getResumeModel()).toBe("gpt-6-luna");
  });
});
