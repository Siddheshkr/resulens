import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getRequiredEnv } from "@/lib/config";
import type { Database } from "@/lib/supabase/database.types";

export async function createServerSupabaseClient(): Promise<SupabaseClient<Database>> {
  const clerkSession = await auth();

  return createClient<Database>(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      accessToken: async () => clerkSession.getToken(),
    },
  );
}
