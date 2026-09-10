import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const appUrl = Deno.env.get("RESULENS_APP_URL");
const workerSecret = Deno.env.get("OPERATIONS_WORKER_SECRET");

if (!appUrl || !workerSecret) throw new Error("Production maintenance configuration is incomplete");

Deno.serve(async () => {
  try {
    const response = await fetch(`${appUrl.replace(/\/$/u, "")}/api/internal/operations`, {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
      headers: { "x-resulens-operations-worker": workerSecret },
    });
    const payload = await response.json().catch(() => ({ error: "Maintenance response invalid" }));
    return Response.json(payload, { status: response.ok ? 200 : 502 });
  } catch {
    return Response.json({ error: "Production maintenance unavailable" }, { status: 503 });
  }
});
