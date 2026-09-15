import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const appUrl = Deno.env.get("RESULENS_APP_URL");
const workerSecret = Deno.env.get("RESUME_WORKER_SECRET");
const configuredBatchSize = Number(Deno.env.get("RESUME_WORKER_BATCH_SIZE") ?? "3");
const batchSize = Number.isFinite(configuredBatchSize)
  ? Math.min(3, Math.max(1, Math.floor(configuredBatchSize)))
  : 3;

if (!supabaseUrl || !serviceRoleKey || !appUrl || !workerSecret) {
  throw new Error("Resume worker configuration is incomplete");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type QueueMessage = {
  msgId: number;
  resumeId: string;
  jobId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseQueueMessages(value: unknown): QueueMessage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.message)) return [];

    const msgId = Number(candidate.msg_id);
    const resumeId = candidate.message.resume_id;
    const jobId = candidate.message.job_id;
    if (!Number.isSafeInteger(msgId) || typeof resumeId !== "string" || typeof jobId !== "string") {
      return [];
    }

    return [{ msgId, resumeId, jobId }];
  });
}

async function resetClaimedJob(jobId: string, resumeId: string, workerId: string) {
  const { data: job } = await supabase
    .from("resume_processing_jobs")
    .select("attempt_count,locked_by")
    .eq("id", jobId)
    .maybeSingle();
  if (!job) return true;
  if (job.locked_by !== workerId) return false;
  const nextAttempt = Math.min(3, Number(job?.attempt_count ?? 0) + 1);
  const terminal = nextAttempt >= 3;

  const { data: resetJob } = await supabase
    .from("resume_processing_jobs")
    .update({
      status: terminal ? "failed" : "queued",
      attempt_count: nextAttempt,
      available_at: new Date(Date.now() + (terminal ? 0 : 60_000)).toISOString(),
      locked_at: null,
      locked_by: null,
      completed_at: terminal ? new Date().toISOString() : null,
      last_error_code: "worker_request_failed",
      last_error_message: "The worker could not process the resume.",
    })
    .eq("id", jobId)
    .eq("status", "processing")
    .eq("locked_by", workerId)
    .select("id")
    .maybeSingle();

  if (!resetJob) {
    const { data: currentJob } = await supabase
      .from("resume_processing_jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();
    return !currentJob || ["failed", "succeeded"].includes(currentJob.status);
  }

  await supabase
    .from("resumes")
    .update({
      status: terminal ? "failed" : "queued",
      processing_stage: terminal ? "failed" : "queued",
      next_retry_at: terminal ? null : new Date(Date.now() + 60_000).toISOString(),
      error_code: "worker_request_failed",
      error_message: "Resume processing could not be completed. Try again.",
    })
    .eq("id", resumeId);

  return terminal;
}

async function acknowledge(msgId: number) {
  await supabase.rpc("ack_resume_processing", { p_message_id: msgId });
}

Deno.serve(async () => {
  const { data: rawMessages, error } = await supabase.rpc("read_resume_processing", {
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
  const results: Array<{ status: string }> = [];

  for (const message of messages) {
    const { data: currentJob } = await supabase
      .from("resume_processing_jobs")
      .select("status,locked_at,locked_by")
      .eq("id", message.jobId)
      .maybeSingle();

    if (!currentJob) {
      await acknowledge(message.msgId);
      continue;
    }
    if (["failed", "succeeded"].includes(currentJob.status)) {
      await acknowledge(message.msgId);
      continue;
    }
    if (
      currentJob.status === "processing" &&
      currentJob.locked_at &&
      Date.parse(currentJob.locked_at) > Date.now() - 300_000
    ) {
      continue;
    }

    const workerId = crypto.randomUUID();
    let claimQuery = supabase
      .from("resume_processing_jobs")
      .update({ status: "processing", locked_at: new Date().toISOString(), locked_by: workerId })
      .eq("id", message.jobId)
      .eq("resume_id", message.resumeId)
      .eq("status", currentJob.status);
    if (currentJob.status === "processing") {
      claimQuery = currentJob.locked_by
        ? claimQuery.eq("locked_by", currentJob.locked_by)
        : claimQuery.is("locked_by", null);
    }
    const { data: claimedJob, error: claimError } = await claimQuery.select("id").maybeSingle();

    if (claimError || !claimedJob) {
      const { data: currentJob } = await supabase
        .from("resume_processing_jobs")
        .select("status")
        .eq("id", message.jobId)
        .maybeSingle();
      if (!currentJob || ["failed", "succeeded"].includes(currentJob.status)) {
        await acknowledge(message.msgId);
      }
      continue;
    }

    try {
      const response = await fetch(`${appUrl.replace(/\/$/u, "")}/api/internal/resumes/process`, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: {
          "content-type": "application/json",
          "x-resulens-worker-secret": workerSecret,
          "x-resulens-worker-id": workerId,
        },
        body: JSON.stringify({ resumeId: message.resumeId, jobId: message.jobId }),
      });
      const payload = (await response.json().catch(() => ({ status: "failed" }))) as {
        status?: string;
      };
      const status = payload.status ?? (response.ok ? "processed" : "failed");
      results.push({ status });

      if (!response.ok) {
        if (await resetClaimedJob(message.jobId, message.resumeId, workerId)) {
          await acknowledge(message.msgId);
        }
        continue;
      }

      if (["needs_review", "failed", "deleted", "idle"].includes(status)) {
        await acknowledge(message.msgId);
      }
    } catch {
      const terminal = await resetClaimedJob(message.jobId, message.resumeId, workerId);
      if (terminal) {
        await acknowledge(message.msgId);
      }
      results.push({ status: terminal ? "failed" : "queued" });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "content-type": "application/json" },
  });
});
