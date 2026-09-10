import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { rawFileDeleteAfter } from "@/server/resumes/retention";

describe("rawFileDeleteAfter", () => {
  const approvedAt = new Date("2026-09-10T00:00:00.000Z");

  it("expires immediately after approval when privacy-first retention is selected", () => {
    expect(rawFileDeleteAfter("delete_after_approval", approvedAt)).toBe(
      "2026-09-10T00:00:00.000Z",
    );
  });

  it("expires exactly thirty days after approval when recovery retention is selected", () => {
    expect(rawFileDeleteAfter("retain_30_days", approvedAt)).toBe("2026-10-10T00:00:00.000Z");
  });
});
