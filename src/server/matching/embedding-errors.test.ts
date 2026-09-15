import { describe, expect, it } from "vitest";

import {
  classifyEmbeddingError,
  embeddingFailureMessage,
} from "@/server/matching/embedding-errors";

describe("classifyEmbeddingError", () => {
  it("treats exhausted provider credits as a terminal failure", () => {
    expect(
      classifyEmbeddingError({
        code: "credit_balance_exhausted",
        type: "insufficient_quota",
        status: 429,
      }),
    ).toMatchObject({ code: "provider_quota_exhausted", retryable: false });
    expect(embeddingFailureMessage("provider_quota_exhausted")).toContain("Add API credits");
  });

  it("keeps ordinary provider rate limits retryable", () => {
    expect(classifyEmbeddingError({ code: "rate_limit_exceeded", status: 429 })).toMatchObject({
      code: "provider_rate_limited",
      retryable: true,
    });
  });
});
