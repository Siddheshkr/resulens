import { describe, expect, it, vi } from "vitest";

import { checkRateLimit, clearRateLimitBucketsForTests } from "@/lib/security/rate-limit";

vi.mock("server-only", () => ({}));

describe("resume rate limits", () => {
  it("limits a key within its window and resets after expiry", () => {
    clearRateLimitBucketsForTests();

    expect(checkRateLimit("synthetic-user", 2, 1_000, 1_000).allowed).toBe(true);
    expect(checkRateLimit("synthetic-user", 2, 1_000, 1_100).allowed).toBe(true);
    expect(checkRateLimit("synthetic-user", 2, 1_000, 1_200).allowed).toBe(false);
    expect(checkRateLimit("synthetic-user", 2, 1_000, 2_001).allowed).toBe(true);
  });
});
