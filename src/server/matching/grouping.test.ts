import { describe, expect, it } from "vitest";

import { takeDistinctCrossPostings } from "@/server/matching/grouping";

describe("cross-posted job grouping", () => {
  it("keeps the highest-ranked source row for each likely posting", () => {
    const ranked = [
      { id: "best-a", job: { cross_posting_key: "same-role" } },
      { id: "duplicate-a", job: { cross_posting_key: "same-role" } },
      { id: "different", job: { cross_posting_key: "different-role" } },
    ];

    expect(takeDistinctCrossPostings(ranked, 10).map((item) => item.id)).toEqual([
      "best-a",
      "different",
    ]);
  });

  it("honors the result limit after grouping", () => {
    const ranked = [
      { id: "one", job: { cross_posting_key: "one" } },
      { id: "two", job: { cross_posting_key: "two" } },
    ];

    expect(takeDistinctCrossPostings(ranked, 1)).toHaveLength(1);
  });
});
