import { afterEach, describe, expect, it, vi } from "vitest";

import { estimateAiCostMicrousd } from "@/lib/ai/cost";

describe("estimateAiCostMicrousd", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses environment-owned model rates without hard-coding provider prices", () => {
    vi.stubEnv(
      "AI_COST_RATES_JSON",
      JSON.stringify({
        model: { inputMicrousdPerMillion: 2_000_000, outputMicrousdPerMillion: 8_000_000 },
      }),
    );
    expect(estimateAiCostMicrousd("model", 1_000, 500)).toBe(6_000);
  });

  it("returns null when a model has no reviewed rate", () => {
    vi.stubEnv("AI_COST_RATES_JSON", "{}");
    expect(estimateAiCostMicrousd("unknown", 100, 0)).toBeNull();
  });
});
