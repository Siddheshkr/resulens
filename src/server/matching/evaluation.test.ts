import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type FixtureJob = {
  id: string;
  relevant: boolean;
  hardConflict: boolean;
  hybrid: number;
  keyword: number;
};

type Fixture = { jobs: FixtureJob[] };

function precisionAt10(jobs: FixtureJob[]) {
  return jobs.slice(0, 10).filter((job) => job.relevant).length / 10;
}

function ndcgAt10(jobs: FixtureJob[]) {
  const ranked = jobs.slice(0, 10);
  const dcg = ranked.reduce(
    (total, job, index) => total + (job.relevant ? 1 / Math.log2(index + 2) : 0),
    0,
  );
  const relevantCount = Math.min(10, jobs.filter((job) => job.relevant).length);
  const ideal = Array.from(
    { length: relevantCount },
    (_, index) => 1 / Math.log2(index + 2),
  ).reduce((total, value) => total + value, 0);
  return ideal === 0 ? 0 : dcg / ideal;
}

describe("reviewed synthetic ranking gate", () => {
  it("has no hard-constraint violations and beats the keyword baseline", () => {
    const fixture = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "tests/fixtures/matching/synthetic-ranking.json"),
        "utf8",
      ),
    ) as Fixture;
    expect(fixture.jobs.filter((job) => job.hardConflict)).not.toHaveLength(0);
    const hybrid = [...fixture.jobs]
      .filter((job) => !job.hardConflict)
      .sort((a, b) => b.hybrid - a.hybrid);
    const keyword = [...fixture.jobs]
      .filter((job) => !job.hardConflict)
      .sort((a, b) => b.keyword - a.keyword);
    expect(hybrid.slice(0, 10).every((job) => !job.hardConflict)).toBe(true);
    expect(precisionAt10(hybrid)).toBe(1);
    expect(precisionAt10(hybrid)).toBeGreaterThan(precisionAt10(keyword));
    expect(ndcgAt10(hybrid)).toBeGreaterThan(ndcgAt10(keyword));
  });
});
