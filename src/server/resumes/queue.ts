import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

export async function enqueueResumeProcessing(
  admin: AdminClient,
  input: { resumeId: string; jobId: string; delaySeconds?: number },
) {
  const { data, error } = await admin.rpc("enqueue_resume_processing", {
    p_resume_id: input.resumeId,
    p_job_id: input.jobId,
    p_delay_seconds: input.delaySeconds ?? 0,
  });

  if (error || typeof data !== "number") {
    throw new Error("Could not enqueue resume processing");
  }

  return data;
}
