import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getRequiredEnv } from "@/lib/config";
import type { Database } from "@/lib/supabase/database.types";

export function createAdminSupabaseClient(): SupabaseClient<Database> {
  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
