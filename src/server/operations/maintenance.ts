import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { reportOperationalSnapshot } from "@/lib/observability/operations";
import { z } from "zod";
import { runDueAccountDeletionJobs } from "@/server/accounts/cleanup";
import { deleteExpiredRawResumeFiles } from "@/server/resumes/retention";

const STALLED_AFTER_MS = 10 * 60_000;

export async function recoverStalledProcessing() {
  const admin = createAdminSupabaseClient();
  const cutoff = new Date(Date.now() - STALLED_AFTER_MS).toISOString();
  const { data: resumeJobs, error: resumeError } = await admin
    .from("resume_processing_jobs")
    .select("id,resume_id,attempt_count")
    .eq("status", "processing")
    .lt("locked_at", cutoff)
    .limit(25);
  if (resumeError) throw new Error("Could not inspect resume processing recovery");

  let resumeRecovered = 0;
  let resumeFailed = 0;
  for (const job of resumeJobs ?? []) {
    const terminal = job.attempt_count >= 3;
    const status = terminal ? "failed" : "queued";
    const availableAt = new Date(Date.now() + (terminal ? 0 : 60_000)).toISOString();
    const { error } = await admin
      .from("resume_processing_jobs")
      .update({
        status,
        available_at: availableAt,
        locked_at: null,
        locked_by: null,
        completed_at: terminal ? new Date().toISOString() : null,
        last_error_code: "stalled_worker_recovered",
        last_error_message: terminal
          ? "Resume processing stopped after its retry limit."
          : "Resume processing was recovered and queued again.",
      })
      .eq("id", job.id)
      .eq("status", "processing")
      .lt("locked_at", cutoff);
    if (error) continue;
    await admin
      .from("resumes")
      .update({
        status,
        processing_stage: terminal ? "failed" : "queued",
        next_retry_at: terminal ? null : availableAt,
        error_code: "stalled_worker_recovered",
        error_message: terminal
          ? "The scan stopped after its retry limit. Upload the resume again."
          : "The scan was recovered and will continue shortly.",
      })
      .eq("id", job.resume_id);
    if (terminal) resumeFailed += 1;
    else resumeRecovered += 1;
  }

  const { data: embeddingJobs, error: embeddingError } = await admin
    .from("embedding_jobs")
    .select("id,attempt_count")
    .eq("status", "processing")
    .lt("locked_at", cutoff)
    .limit(25);
  if (embeddingError) throw new Error("Could not inspect embedding recovery");
  let embeddingRecovered = 0;
  let embeddingFailed = 0;
  for (const job of embeddingJobs ?? []) {
    const terminal = job.attempt_count >= 3;
    const { error } = await admin
      .from("embedding_jobs")
      .update({
        status: terminal ? "failed" : "queued",
        available_at: new Date(Date.now() + (terminal ? 0 : 60_000)).toISOString(),
        locked_at: null,
        locked_by: null,
        completed_at: terminal ? new Date().toISOString() : null,
        last_error_code: "stalled_worker_recovered",
        last_error_message: terminal
          ? "Embedding processing stopped after its retry limit."
          : "Embedding processing was recovered and queued again.",
      })
      .eq("id", job.id)
      .eq("status", "processing")
      .lt("locked_at", cutoff);
    if (error) continue;
    if (terminal) embeddingFailed += 1;
    else embeddingRecovered += 1;
  }

  return { resumeRecovered, resumeFailed, embeddingRecovered, embeddingFailed };
}

export async function runMaintenance() {
  const admin = createAdminSupabaseClient();
  const [accountDeletion, rawFileRetention, processingRecovery] = await Promise.all([
    runDueAccountDeletionJobs(admin),
    deleteExpiredRawResumeFiles(admin),
    recoverStalledProcessing(),
  ]);
  const snapshot = await getOperationalSnapshot();
  reportOperationalSnapshot(snapshot);
  return { accountDeletion, rawFileRetention, processingRecovery, snapshot };
}

export async function getOperationalSnapshot() {
  const admin = createAdminSupabaseClient();
  const stalledCutoff = new Date(Date.now() - STALLED_AFTER_MS).toISOString();
  const staleSourceCutoff = new Date(Date.now() - 12 * 60 * 60_000).toISOString();
  const { data, error } = await admin.rpc("get_resulens_operational_snapshot", {
    p_stalled_before: stalledCutoff,
    p_stale_source_before: staleSourceCutoff,
    p_usage_since: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),
  });
  if (error) throw new Error("Could not load operational snapshot");
  const counts = z
    .object({
      failedResumes: z.number().nonnegative(),
      stalledResumes: z.number().nonnegative(),
      failedEmbeddings: z.number().nonnegative(),
      staleSources: z.number().nonnegative(),
      incompleteAccountDeletions: z.number().nonnegative(),
      estimatedAiSpendMicrousd24h: z.number().nonnegative(),
    })
    .parse(data);
  return {
    checkedAt: new Date().toISOString(),
    ...counts,
    aiSpendAlert:
      counts.estimatedAiSpendMicrousd24h >=
      Number(process.env.AI_SPEND_ALERT_MICROUSD_24H ?? Number.POSITIVE_INFINITY),
  };
}
