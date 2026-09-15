#!/usr/bin/env node

import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const appUrl = process.env.RESULENS_APP_URL ?? "http://127.0.0.1:3000";
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resumeWorkerSecret = process.env.RESUME_WORKER_SECRET;
const matchingWorkerSecret = process.env.MATCHING_WORKER_SECRET;

const args = new Set(process.argv.slice(2));
const watch = args.has("--watch");
const resumeOnly = args.has("--resume-only");
const embeddingsOnly = args.has("--embeddings-only");
const pollIntervalMs = 15_000;
const requestTimeoutMs = 120_000;

function positiveIntegerArg(name, fallback, maximum) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(1, parsed)) : fallback;
}

const resumeLimit = positiveIntegerArg("resume-limit", 3, 3);
const embeddingLimit = positiveIntegerArg("embedding-limit", 5, 5);

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Local workers need SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

if (!resumeOnly && !embeddingsOnly && (!resumeWorkerSecret || !matchingWorkerSecret)) {
  console.error("Local workers need both RESUME_WORKER_SECRET and MATCHING_WORKER_SECRET.");
  process.exit(1);
}

if (!embeddingsOnly && !resumeWorkerSecret) {
  console.error("The resume worker needs RESUME_WORKER_SECRET.");
  process.exit(1);
}

if (!resumeOnly && !matchingWorkerSecret) {
  console.error("The matching worker needs MATCHING_WORKER_SECRET.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function parseMessages(value, type) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!isRecord(candidate) || !isRecord(candidate.message)) return [];

    const messageId = Number(candidate.msg_id);
    const identifier =
      type === "resume" ? candidate.message.resume_id : candidate.message.embedding_job_id;
    const jobId = type === "resume" ? candidate.message.job_id : undefined;
    if (
      !Number.isSafeInteger(messageId) ||
      typeof identifier !== "string" ||
      (type === "resume" && typeof jobId !== "string")
    ) {
      return [];
    }

    return [{ messageId, identifier, ...(jobId ? { jobId } : {}) }];
  });
}

async function acknowledge(type, messageId) {
  const functionName = type === "resume" ? "ack_resume_processing" : "ack_embedding_processing";
  const { error } = await supabase.rpc(functionName, { p_message_id: messageId });
  if (error) throw new Error(`Could not acknowledge the ${type} queue message`);
}

function queueSummary(read = 0) {
  return {
    read,
    processed: 0,
    acknowledged: 0,
    queued: 0,
    failed: 0,
    http_errors: {},
    network_errors: 0,
  };
}

async function invokeProcessor(type, identifier, jobId) {
  const secret = type === "resume" ? resumeWorkerSecret : matchingWorkerSecret;
  const endpoint =
    type === "resume" ? "/api/internal/resumes/process" : "/api/internal/matching/embeddings";
  const headerName = type === "resume" ? "x-resulens-worker-secret" : "x-resulens-matching-worker";
  const workerId = randomUUID();
  const body = type === "resume" ? { resumeId: identifier, jobId } : { embeddingJobId: identifier };

  try {
    const response = await fetch(`${appUrl.replace(/\/$/u, "")}${endpoint}`, {
      method: "POST",
      signal: AbortSignal.timeout(requestTimeoutMs),
      headers: {
        "content-type": "application/json",
        [headerName]: secret,
        "x-resulens-worker-id": workerId,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    const status =
      isRecord(payload) && typeof payload.status === "string" ? payload.status : "failed";
    return { ok: response.ok, status, httpStatus: response.status, networkError: false };
  } catch {
    return { ok: false, status: "failed", httpStatus: null, networkError: true };
  }
}

function isTerminalStatus(type, status) {
  return type === "resume"
    ? new Set(["needs_review", "failed", "deleted", "idle"]).has(status)
    : new Set(["succeeded", "skipped", "stale", "idle", "failed"]).has(status);
}

async function recordDelivery(type, delivery, messageId, summary) {
  if (!delivery.ok) {
    summary.failed += 1;
    if (delivery.networkError) {
      summary.network_errors += 1;
    } else {
      const statusKey = String(delivery.httpStatus);
      summary.http_errors[statusKey] = (summary.http_errors[statusKey] ?? 0) + 1;
    }
    return;
  }

  summary.processed += 1;
  if (isTerminalStatus(type, delivery.status)) {
    if (messageId !== null) {
      await acknowledge(type, messageId);
      summary.acknowledged += 1;
    }
  } else {
    summary.queued += 1;
  }
}

async function processQueue(type, limit) {
  const functionName = type === "resume" ? "read_resume_processing" : "read_embedding_processing";
  const { data, error } = await supabase.rpc(functionName, {
    p_visibility_timeout: 300,
    p_limit: limit,
  });
  if (error) throw new Error(`Could not read the ${type} queue`);

  const messages = parseMessages(data, type);
  const summary = queueSummary(messages.length);

  for (const message of messages) {
    const delivery = await invokeProcessor(type, message.identifier, message.jobId);
    await recordDelivery(type, delivery, message.messageId, summary);
  }

  return summary;
}

async function processPendingResumeEmbedding() {
  const { data: job, error } = await supabase
    .from("embedding_jobs")
    .select("id")
    .eq("subject_type", "resume")
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Could not inspect the resume embedding queue");
  if (!job) return { status: "idle" };

  // Resume embeddings are prioritized locally so a large backlog of job
  // embeddings cannot make an approved profile appear stuck indefinitely.
  const delivery = await invokeProcessor("embedding", job.id);
  return {
    status: delivery.status,
    failed: !delivery.ok,
    http_status: delivery.httpStatus,
    network_error: delivery.networkError,
  };
}

async function runOnce() {
  const result = {};
  if (!embeddingsOnly) result.resume = await processQueue("resume", resumeLimit);
  if (!resumeOnly) {
    result.resume_embedding = await processPendingResumeEmbedding();
    result.embeddings = await processQueue("embedding", embeddingLimit);
  }
  console.log(JSON.stringify({ event: "local_workers_run", ...result }));
}

await runOnce();

if (watch) {
  console.log(JSON.stringify({ event: "local_workers_watching", interval_ms: pollIntervalMs }));
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    try {
      await runOnce();
    } catch {
      console.error(JSON.stringify({ event: "local_workers_run_failed" }));
    }
  }
}
