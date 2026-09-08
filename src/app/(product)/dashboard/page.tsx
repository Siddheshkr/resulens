import { redirect } from "next/navigation";

import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let userId: string;

  try {
    ({ userId } = await requireUser());
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/sign-in?redirect_url=/dashboard");
    }

    throw error;
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId }, { onConflict: "user_id" });

  if (error) {
    throw new Error(`Could not initialize the profile: ${error.message}`);
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
      <div className="rounded-3xl border border-white/10 bg-[var(--card)] p-8 shadow-2xl shadow-black/20">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--brand)]">
          Phase 1 foundation
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--foreground)]">
          Your ResuLens workspace
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">
          Clerk authentication and the Supabase ownership boundary are connected. Resume scanning
          and job matching arrive in the next phases.
        </p>
        <p className="mt-6 rounded-xl border border-white/10 bg-black/25 px-4 py-3 font-mono text-xs text-[var(--muted)]">
          Clerk user: {userId}
        </p>
      </div>
    </div>
  );
}
