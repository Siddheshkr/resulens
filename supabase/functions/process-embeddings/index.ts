import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const appUrl = Deno.env.get("RESULENS_APP_URL");
const workerSecret = Deno.env.get("MATCHING_WORKER_SECRET");
const configuredBatchSize = Number(Deno.env.get("MATCHING_WORKER_BATCH_SIZE") ?? "5");
const batchSize = Number.isFinite(configuredBatchSize)
  ? Math.min(5, Math.max(1, Math.floor(configuredBatchSize)))
  : 5;

if (!supabaseUrl || !serviceRoleKey || !appUrl || !workerSecret) {
  throw new Error("Matching worker configuration is incomplete");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type QueueMessage = { msgId: number; embeddingJobId: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseQueueMessages(value: unknown): QueueMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.message)) return [];
    const msgId = Number(candidate.msg_id);
    const embeddingJobId = candidate.message.embedding_job_id;
    if (!Number.isSafeInteger(msgId) || typeof embeddingJobId !== "string") return [];
    return [{ msgId, embeddingJobId }];
  });
}

async function acknowledge(msgId: number) {
  await supabase.rpc("ack_embedding_processing", { p_message_id: msgId });
}

async function resetJob(embeddingJobId: string) {
  const { data: job } = await supabase
    .from("embedding_jobs")
    .select("attempt_count")
    .eq("id", embeddingJobId)
    .maybeSingle();
  const attemptCount = Math.min(3, Number(job?.attempt_count ?? 0) + 1);
  const terminal = attemptCount >= 3;
  await supabase
    .from("embedding_jobs")
    .update({
      status: terminal ? "failed" : "queued",
      available_at: new Date(Date.now() + (terminal ? 0 : 60_000)).toISOString(),
      locked_at: null,
      locked_by: null,
      completed_at: terminal ? new Date().toISOString() : null,
      last_error_code: "worker_request_failed",
      last_error_message: "The matching worker could not process the embedding.",
    })
    .eq("id", embeddingJobId)
    .eq("status", "processing");
  return terminal;
}

Deno.serve(async () => {
  const { data: rawMessages, error } = await supabase.rpc("read_embedding_processing", {
    p_visibility_timeout: 300,
    p_limit: batchSize,
  });
  if (error) {
    return new Response(JSON.stringify({ error: "Queue unavailable" }), {
      status: 503,
      headers: { "content-type": "application/json" },
    });
  }

  const messages = parseQueueMessages(rawMessages);
  const results: Array<{ embeddingJobId: string; status: string }> = [];
  for (const message of messages) {
    const { data: current } = await supabase
      .from("embedding_jobs")
      .select("status,locked_at,locked_by")
      .eq("id", message.embeddingJobId)
      .maybeSingle();
    if (!current || ["failed", "succeeded"].includes(current.status)) {
      await acknowledge(message.msgId);
      continue;
    }
    if (
      current.status === "processing" &&
      current.locked_at &&
      Date.parse(current.locked_at) > Date.now() - 300_000
    ) {
      continue;
    }

    const workerId = crypto.randomUUID();
    const claim = await supabase
      .from("embedding_jobs")
      .update({ status: "processing", locked_at: new Date().toISOString(), locked_by: workerId })
      .eq("id", message.embeddingJobId)
      .eq("status", current.status)
      .select("id")
      .maybeSingle();
    if (claim.error || !claim.data) continue;

    try {
      const response = await fetch(
        `${appUrl.replace(/\/$/u, "")}/api/internal/matching/embeddings`,
        {
          method: "POST",
          signal: AbortSignal.timeout(120_000),
          headers: {
            "content-type": "application/json",
            "x-resulens-matching-worker": workerSecret,
            "x-resulens-worker-id": workerId,
          },
          body: JSON.stringify({ embeddingJobId: message.embeddingJobId }),
        },
      );
      const payload = (await response.json().catch(() => ({ status: "failed" }))) as {
        status?: string;
      };
      const status = payload.status ?? (response.ok ? "succeeded" : "failed");
      results.push({ embeddingJobId: message.embeddingJobId, status });
      if (!response.ok) {
        if (await resetJob(message.embeddingJobId)) await acknowledge(message.msgId);
        continue;
      }
      if (["succeeded", "skipped", "stale", "idle", "failed"].includes(status)) {
        await acknowledge(message.msgId);
      }
    } catch {
      const terminal = await resetJob(message.embeddingJobId);
      results.push({
        embeddingJobId: message.embeddingJobId,
        status: terminal ? "failed" : "queued",
      });
      if (terminal) await acknowledge(message.msgId);
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "content-type": "application/json" },
  });
});
