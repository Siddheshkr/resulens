import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const appUrl = Deno.env.get("RESULENS_APP_URL");
const workerSecret = Deno.env.get("JOB_INGESTION_SECRET");
const configuredSources = Number(Deno.env.get("JOB_INGESTION_MAX_SOURCES") ?? "3");
const maxSources = Number.isFinite(configuredSources)
  ? Math.min(10, Math.max(1, Math.floor(configuredSources)))
  : 3;

if (!appUrl || !workerSecret) {
  throw new Error("Job ingestion worker configuration is incomplete");
}

Deno.serve(async () => {
  try {
    const response = await fetch(`${appUrl.replace(/\/$/u, "")}/api/internal/jobs/ingest`, {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
      headers: {
        "content-type": "application/json",
        "x-resulens-job-worker": workerSecret,
      },
      body: JSON.stringify({ maxSources }),
    });
    const payload = await response.json().catch(() => ({ results: [] }));
    return new Response(JSON.stringify(payload), {
      status: response.ok ? 200 : 502,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Job ingestion worker unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }
});
