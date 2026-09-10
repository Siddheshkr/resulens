import { describe, expect, it } from "vitest";

import { nextEmbeddingAttempt } from "../../../supabase/functions/_shared/embedding-retry";

describe("embedding worker retries", () => {
  it("reaches a terminal state after three failed worker requests", () => {
    expect(nextEmbeddingAttempt(0)).toEqual({ attemptCount: 1, terminal: false });
    expect(nextEmbeddingAttempt(1)).toEqual({ attemptCount: 2, terminal: false });
    expect(nextEmbeddingAttempt(2)).toEqual({ attemptCount: 3, terminal: true });
    expect(nextEmbeddingAttempt(3)).toEqual({ attemptCount: 3, terminal: true });
  });
});
