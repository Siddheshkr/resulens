import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

const PROFILE_COLUMNS =
  "user_id,onboarding_completed_at,raw_file_retention_policy,deletion_status,deletion_requested_at" as const;

/**
 * Lazily creates the Clerk-owned profile without requiring UPDATE privileges on
 * protected lifecycle columns when the row already exists.
 */
export async function ensureUserProfile(client: SupabaseClient<Database>, userId: string) {
  const { error: insertError } = await client
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });

  if (insertError) throw new Error("Could not initialize the account profile");

  const { data, error } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("user_id", userId)
    .single();

  if (error || !data) throw new Error("Could not load the account profile");
  return data;
}
