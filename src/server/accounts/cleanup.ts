import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/lib/supabase/database.types";

const MAX_DELETION_ATTEMPTS = 5;
type DeletionJob = Tables<"account_deletion_jobs">;

function errorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  return typeof error.status === "number" ? error.status : null;
}

async function recordFailure(admin: SupabaseClient<Database>, job: DeletionJob, code: string) {
  const attemptCount = Math.min(MAX_DELETION_ATTEMPTS, job.attempt_count + 1);
  const terminal = attemptCount >= MAX_DELETION_ATTEMPTS;
  await admin
    .from("account_deletion_jobs")
    .update({
      status: "failed",
      attempt_count: attemptCount,
      available_at: new Date(
        Date.now() + (terminal ? 24 * 60 : attemptCount * 5) * 60_000,
      ).toISOString(),
      locked_at: null,
      last_error_code: code,
    })
    .eq("user_id", job.user_id);
  await admin.from("profiles").update({ deletion_status: "failed" }).eq("user_id", job.user_id);
  return { status: "pending" as const, errorCode: code, terminal };
}

export async function requestAccountDeletion(
  userId: string,
  source: "application" | "clerk_webhook",
  admin = createAdminSupabaseClient(),
) {
  const { data: existing } = await admin
    .from("account_deletion_jobs")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.status === "complete") return { status: "complete" as const };

  const requestedAt = new Date().toISOString();
  await admin
    .from("profiles")
    .update({ deletion_requested_at: requestedAt, deletion_status: "pending" })
    .eq("user_id", userId);

  const { error } = await admin.from("account_deletion_jobs").upsert(
    {
      user_id: userId,
      source,
      status: "pending",
      available_at: requestedAt,
      locked_at: null,
      last_error_code: null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("Could not create account cleanup job");
  return runAccountDeletion(userId, admin);
}

export async function runAccountDeletion(userId: string, admin = createAdminSupabaseClient()) {
  const { data: jobData, error: jobError } = await admin
    .from("account_deletion_jobs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (jobError || !jobData) throw new Error("Could not load account cleanup job");
  const job = jobData as DeletionJob;
  if (job.status === "complete") return { status: "complete" as const };
  if (
    job.status === "processing" &&
    job.locked_at &&
    Date.parse(job.locked_at) > Date.now() - 10 * 60_000
  ) {
    return { status: "pending" as const };
  }

  const now = new Date().toISOString();
  let claimQuery = admin
    .from("account_deletion_jobs")
    .update({ status: "processing", locked_at: now, last_error_code: null })
    .eq("user_id", userId)
    .eq("status", job.status);
  claimQuery = job.locked_at
    ? claimQuery.eq("locked_at", job.locked_at)
    : claimQuery.is("locked_at", null);
  const { data: claimed } = await claimQuery.select("user_id").maybeSingle();
  if (!claimed) return { status: "pending" as const };

  await admin.from("profiles").update({ deletion_status: "processing" }).eq("user_id", userId);

  let current = job;
  if (current.source === "application" && !current.clerk_user_deleted_at) {
    try {
      const client = await clerkClient();
      const sessions = await client.sessions.getSessionList({ userId, limit: 100 });
      await Promise.all(sessions.data.map((session) => client.sessions.revokeSession(session.id)));
    } catch (error) {
      if (errorStatus(error) !== 404) {
        return recordFailure(admin, current, "session_revocation_failed");
      }
    }
  }

  if (!current.storage_deleted_at) {
    const { data: resumes, error: resumeError } = await admin
      .from("resumes")
      .select("storage_path,raw_file_deleted_at")
      .eq("user_id", userId);
    if (resumeError) return recordFailure(admin, current, "resume_inventory_failed");
    const paths = (resumes ?? [])
      .filter((resume) => !resume.raw_file_deleted_at)
      .map((resume) => resume.storage_path);
    if (paths.length) {
      const { error } = await admin.storage.from("resumes").remove(paths);
      if (error) return recordFailure(admin, current, "storage_cleanup_failed");
    }
    const storageDeletedAt = new Date().toISOString();
    await admin
      .from("account_deletion_jobs")
      .update({ storage_deleted_at: storageDeletedAt })
      .eq("user_id", userId);
    current = { ...current, storage_deleted_at: storageDeletedAt };
  }

  if (!current.data_deleted_at) {
    const { error } = await admin.from("profiles").delete().eq("user_id", userId);
    if (error) return recordFailure(admin, current, "database_cleanup_failed");
    const dataDeletedAt = new Date().toISOString();
    await admin
      .from("account_deletion_jobs")
      .update({ data_deleted_at: dataDeletedAt })
      .eq("user_id", userId);
    current = { ...current, data_deleted_at: dataDeletedAt };
  }

  if (current.source === "application" && !current.clerk_user_deleted_at) {
    try {
      const client = await clerkClient();
      await client.users.deleteUser(userId);
    } catch (error) {
      if (errorStatus(error) !== 404) {
        return recordFailure(admin, current, "clerk_cleanup_failed");
      }
    }
  }

  const completedAt = new Date().toISOString();
  const { error: completeError } = await admin
    .from("account_deletion_jobs")
    .update({
      status: "complete",
      clerk_user_deleted_at: completedAt,
      completed_at: completedAt,
      locked_at: null,
      last_error_code: null,
    })
    .eq("user_id", userId);
  if (completeError) return recordFailure(admin, current, "cleanup_finalize_failed");
  return { status: "complete" as const };
}

export async function runDueAccountDeletionJobs(admin = createAdminSupabaseClient(), limit = 10) {
  const staleLock = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data, error } = await admin
    .from("account_deletion_jobs")
    .select("user_id")
    .in("status", ["pending", "failed", "processing"])
    .lte("available_at", new Date().toISOString())
    .or(`locked_at.is.null,locked_at.lt.${staleLock}`)
    .limit(Math.max(1, Math.min(limit, 25)));
  if (error) throw new Error("Could not load due cleanup jobs");

  const results = [];
  for (const job of data ?? []) results.push(await runAccountDeletion(job.user_id, admin));
  return { processed: results.length, results };
}
