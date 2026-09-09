import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { PROFILE_PROMPT_VERSION, PROFILE_SCHEMA_VERSION } from "@/lib/resumes/constants";
import { resumeProfileSchema, calculateAverageConfidence } from "@/lib/resumes/profile-schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const profileResult = resumeProfileSchema.safeParse(body?.profile);

    if (!profileResult.success) {
      return Response.json(
        { error: "Review the highlighted profile fields and try again." },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select("id,status")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (resumeError) {
      throw new Error("Could not load the resume");
    }
    if (!resume) {
      return Response.json({ error: "Resume not found" }, { status: 404 });
    }
    if (resume.status === "deleting" || resume.status === "deleted") {
      return Response.json({ error: "This resume is being deleted." }, { status: 409 });
    }

    const { data: latest } = await supabase
      .from("resume_profiles")
      .select("version")
      .eq("resume_id", id)
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (latest?.version ?? 0) + 1;

    const { data: savedProfile, error: insertError } = await supabase
      .from("resume_profiles")
      .insert({
        resume_id: id,
        user_id: userId,
        version,
        status: "draft",
        profile: profileResult.data,
        schema_version: PROFILE_SCHEMA_VERSION,
        prompt_version: PROFILE_PROMPT_VERSION,
        model: null,
        source_mode: "manual",
        average_confidence: calculateAverageConfidence(profileResult.data),
      })
      .select("id,version,status,profile,average_confidence,created_at,updated_at")
      .single();
    if (insertError || !savedProfile) {
      throw new Error("Could not save the profile changes");
    }

    const { error: updateError } = await supabase
      .from("resumes")
      .update({
        status: "needs_review",
        processing_stage: "review",
        latest_profile_version: version,
        derived_profile_version: null,
        approved_profile_version: null,
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) {
      throw new Error("Could not update the profile status");
    }

    return Response.json({ profile: savedProfile });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return unauthorized();
    }

    throw error;
  }
}
