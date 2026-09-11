import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasValidWorkerSecret } from "@/lib/security/worker-secret";
import { ingestActiveJobSources } from "@/server/job-sources/ingest";

import { POST } from "@/app/api/internal/jobs/ingest/route";

vi.mock("@/lib/security/worker-secret", () => ({ hasValidWorkerSecret: vi.fn() }));
vi.mock("@/server/job-sources/ingest", () => ({ ingestActiveJobSources: vi.fn() }));

describe("POST /api/internal/jobs/ingest", () => {
  beforeEach(() => {
    vi.mocked(hasValidWorkerSecret).mockReset();
    vi.mocked(ingestActiveJobSources).mockReset();
  });

  it("does not reveal whether the worker secret exists", async () => {
    vi.mocked(hasValidWorkerSecret).mockReturnValue(false);
    const response = await POST(new Request("http://resulens.test/api/internal/jobs/ingest"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });

  it("rejects unbounded ingestion requests before starting provider work", async () => {
    vi.mocked(hasValidWorkerSecret).mockReturnValue(true);
    const response = await POST(
      new Request("http://resulens.test/api/internal/jobs/ingest", {
        method: "POST",
        body: JSON.stringify({ maxSources: 11, maxPages: 0 }),
      }),
    );

    expect(response.status).toBe(400);
    expect(ingestActiveJobSources).not.toHaveBeenCalled();
  });

  it("passes validated bounds to the ingestion service", async () => {
    vi.mocked(hasValidWorkerSecret).mockReturnValue(true);
    vi.mocked(ingestActiveJobSources).mockResolvedValue([]);
    const response = await POST(
      new Request("http://resulens.test/api/internal/jobs/ingest", {
        method: "POST",
        body: JSON.stringify({ maxSources: 2, maxPages: 3 }),
      }),
    );

    expect(response.status).toBe(200);
    expect(ingestActiveJobSources).toHaveBeenCalledWith(
      expect.objectContaining({ maxSources: 2, maxPages: 3 }),
    );
  });
});
