import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { RawFileRetentionPolicy } from "@/lib/accounts/requests";
import type { Database } from "@/lib/supabase/database.types";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1_000;

export function rawFileDeleteAfter(policy: RawFileRetentionPolicy, approvedAt = new Date()) {
  return new Date(
    approvedAt.getTime() + (policy === "retain_30_days" ? THIRTY_DAYS_MS : 0),
  ).toISOString();
}

export async function deleteRawResumeFile(
  admin: SupabaseClient<Database>,
  resume: { id: string; storage_path: string; raw_file_deleted_at?: string | null },
) {
  if (resume.raw_file_deleted_at) return true;

  const { error: storageError } = await admin.storage.from("resumes").remove([resume.storage_path]);
  if (storageError) return false;

  const { error: updateError } = await admin
    .from("resumes")
    .update({ raw_file_deleted_at: new Date().toISOString() })
    .eq("id", resume.id);
  return !updateError;
}

export async function deleteExpiredRawResumeFiles(admin: SupabaseClient<Database>, limit = 25) {
  const { data, error } = await admin
    .from("resumes")
    .select("id,storage_path,raw_file_deleted_at")
    .not("raw_file_delete_after", "is", null)
    .is("raw_file_deleted_at", null)
    .lte("raw_file_delete_after", new Date().toISOString())
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw new Error("Could not load expired raw files");

  let deleted = 0;
  let failed = 0;
  for (const resume of data ?? []) {
    if (await deleteRawResumeFile(admin, resume)) deleted += 1;
    else failed += 1;
  }
  return { scanned: data?.length ?? 0, deleted, failed };
}
