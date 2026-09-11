import { hasValidWorkerSecret } from "@/lib/security/worker-secret";
import { ingestActiveJobSources } from "@/server/job-sources/ingest";
import { ingestionRequestSchema } from "@/server/job-sources/requests";

export const dynamic = "force-dynamic";

function hasWorkerSecret(request: Request) {
  return hasValidWorkerSecret(
    process.env.JOB_INGESTION_SECRET,
    request.headers.get("x-resulens-job-worker"),
  );
}

export async function POST(request: Request) {
  if (!hasWorkerSecret(request)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const body = ingestionRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Invalid worker request" }, { status: 400 });
  const results = await ingestActiveJobSources({ ...body.data, signal: request.signal });
  return Response.json({ results });
}
