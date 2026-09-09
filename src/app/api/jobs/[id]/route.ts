import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success)
      return Response.json({ error: "Job not found" }, { status: 404 });
    const supabase = await createServerSupabaseClient();
    const [{ data: job, error: jobError }, { data: action, error: actionError }] =
      await Promise.all([
        supabase
          .from("job_postings")
          .select(
            "id,title,description,location_text,country_code,workplace_type,employment_type,seniority,canonical_url,posted_at,source_updated_at,salary_min,salary_max,salary_currency,work_authorization_support,required_experience_min_years,required_experience_max_years,companies(display_name),job_sources(provider,display_name)",
          )
          .eq("id", id)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("job_actions")
          .select("state")
          .eq("user_id", userId)
          .eq("job_posting_id", id)
          .maybeSingle(),
      ]);
    if (jobError || actionError) throw new Error("Could not load job details");
    if (!job) return Response.json({ error: "Job not found" }, { status: 404 });
    return Response.json({ job, action: action?.state ?? null });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return Response.json({ error: "Could not load job details." }, { status: 503 });
  }
}
