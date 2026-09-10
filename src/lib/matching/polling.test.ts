import { describe, expect, it } from "vitest";

import { MATCH_POLL_ATTEMPTS, shouldResumePendingMatch } from "@/lib/matching/polling";

describe("pending match polling", () => {
  it("keeps resume requests below the match-run rate limit", () => {
    const resumeAttempts = Array.from(
      { length: MATCH_POLL_ATTEMPTS },
      (_, index) => index + 1,
    ).filter(shouldResumePendingMatch);

    expect(resumeAttempts).toEqual([4, 8, 12, 16, 20]);
    expect(resumeAttempts).toHaveLength(5);
  });
});
