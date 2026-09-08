"use client";

import { useSession } from "@clerk/nextjs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useMemo } from "react";

import type { Database } from "@/lib/supabase/database.types";

type TokenProvider = () => Promise<string | null>;

export function createBrowserSupabaseClient(getToken: TokenProvider): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase browser configuration is missing");
  }

  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    accessToken: getToken,
  });
}

export function useBrowserSupabaseClient(): SupabaseClient<Database> {
  const { session } = useSession();

  return useMemo(
    () => createBrowserSupabaseClient(() => session?.getToken() ?? Promise.resolve(null)),
    [session],
  );
}
