import { beforeEach, describe, expect, it, vi } from "vitest";

import { adzunaAdapter } from "@/server/job-sources/adzuna";
import { greenhouseAdapter } from "@/server/job-sources/greenhouse";
import { leverAdapter } from "@/server/job-sources/lever";
import { fetchJson } from "@/server/job-sources/http";
import type { JobSource } from "@/server/job-sources/types";

function source(
  provider: JobSource["provider"],
  providerConfig: Record<string, unknown>,
): JobSource {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    provider,
    slug: `${provider}-fixture`,
    displayName: "Synthetic source",
    status: "active",
    providerConfig,
  };
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("job source adapters", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubEnv("ADZUNA_APP_ID", "synthetic-id");
    vi.stubEnv("ADZUNA_APP_KEY", "synthetic-key");
  });

  it("normalizes and sanitizes Greenhouse HTML without storing markup", () => {
    const job = greenhouseAdapter.normalize(
      {
        id: 42,
        title: "Product Engineer",
        absolute_url: "https://boards.greenhouse.io/example/jobs/42#apply",
        updated_at: "2026-09-09T10:00:00Z",
        first_published: "2026-09-01T10:00:00Z",
        content: "<script>steal()</script><p>Build &amp; ship resilient systems.</p>",
        location: { name: "Remote - India" },
        departments: [{ name: "Engineering" }],
      },
      source("greenhouse", { boardToken: "example", countryCode: "IN" }),
    );

    expect(job.externalJobId).toBe("42");
    expect(job.description).toBe("Build & ship resilient systems.");
    expect(job.canonicalUrl).toBe("https://boards.greenhouse.io/example/jobs/42");
    expect(job.workplaceType).toBe("remote");
    expect(job.skills[0]?.normalizedSkill).toBe("engineering");
  });

  it("normalizes Lever pagination and provider categories", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "lever-1",
            text: "Senior Platform Engineer",
            description: "<p>Operate a platform.</p>",
            hostedUrl: "https://jobs.lever.co/example/lever-1",
            createdAt: 1_757_400_000_000,
            categories: {
              location: "Bengaluru · Remote",
              commitment: "Full-time",
              team: "Infrastructure",
              level: "Senior",
            },
          },
          {
            id: "lever-2",
            text: "Product Designer",
            descriptionPlain: "Design product experiences.",
            applyUrl: "https://jobs.lever.co/example/lever-2",
            categories: { location: "Delhi" },
          },
        ]),
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "lever-3",
            text: "Data Analyst",
            descriptionPlain: "Analyze product data.",
            hostedUrl: "https://jobs.lever.co/example/lever-3",
            categories: { location: "Mumbai" },
          },
        ]),
      );
    vi.stubGlobal("fetch", fetchMock);
    const leverSource = source("lever", { site: "example", countryCode: "IN", pageSize: 2 });

    const first = await leverAdapter.fetchPage(leverSource, { page: 1, pageSize: 2 });
    expect(first.nextPage).toBe(2);
    expect(first.complete).toBe(false);
    const normalized = leverAdapter.normalize(first.items[0], leverSource);
    expect(normalized.employmentType).toBe("Full-time");
    expect(normalized.seniority).toBe("Senior");
    expect(normalized.workplaceType).toBe("remote");

    const second = await leverAdapter.fetchPage(leverSource, { page: 2, pageSize: 2 });
    expect(second.complete).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("validates Adzuna responses and uses the documented search endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        count: 1,
        results: [
          {
            id: "adzuna-1",
            title: "TypeScript Engineer",
            description: "Build typed services.",
            redirect_url: "https://www.adzuna.in/details/adzuna-1",
            created: "2026-09-08T09:00:00Z",
            company: { display_name: "Synthetic Labs" },
            location: { display_name: "Pune, India" },
            contract_time: "full_time",
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const adzunaSource = source("adzuna", { countryCode: "in", query: "typescript engineer" });
    const page = await adzunaAdapter.fetchPage(adzunaSource, { page: 1, pageSize: 20 });
    const normalized = adzunaAdapter.normalize(page.items[0], adzunaSource);

    expect(page.complete).toBe(true);
    expect(normalized.company?.normalizedName).toBe("synthetic labs");
    expect(new URL(fetchMock.mock.calls[0]?.[0] as string).pathname).toContain("/jobs/in/search/1");
    expect(fetchMock.mock.calls[0]?.[0] as string).toContain("what=typescript+engineer");
  });

  it("retries bounded transient provider failures without exposing response content", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "temporary" }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();
    const result = await fetchJson<{ ok: boolean }>("https://provider.example/jobs", {
      fetchFn: fetchMock,
      sleep,
      onRetry,
      timeoutMs: 1_000,
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledOnce();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
