import { timingSafeEqual } from "node:crypto";

import { ingestActiveJobSources } from "@/server/job-sources/ingest";

export const dynamic = "force-dynamic";

function hasWorkerSecret(request: Request) {
  const configured = process.env.JOB_INGESTION_SECRET;
  const supplied = request.headers.get("x-resulens-job-worker");
  if (!configured || !supplied) return false;
  const expectedBytes = Buffer.from(configured);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

export async function POST(request: Request) {
  if (!hasWorkerSecret(request)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    maxSources?: unknown;
    maxPages?: unknown;
  };
  const maxSources = typeof body.maxSources === "number" ? body.maxSources : undefined;
  const maxPages = typeof body.maxPages === "number" ? body.maxPages : undefined;
  const results = await ingestActiveJobSources({ maxSources, maxPages, signal: request.signal });
  return Response.json({ results });
}
