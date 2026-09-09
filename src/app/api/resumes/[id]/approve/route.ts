import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { PROFILE_PROMPT_VERSION, PROFILE_SCHEMA_VERSION } from "@/lib/resumes/constants";
import { resumeProfileSchema, calculateAverageConfidence } from "@/lib/resumes/profile-schema";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await context.params;
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
      .select("profile,version")
      .eq("resume_id", id)
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest) {
      return Response.json(
        { error: "Review the extracted profile before approving it." },
        { status: 409 },
      );
    }

    const profileResult = resumeProfileSchema.safeParse(latest.profile);
    if (!profileResult.success) {
      return Response.json(
        { error: "The saved profile is invalid. Edit it and try again." },
        { status: 409 },
      );
    }
    const profile = profileResult.data;
    const approvedVersion = latest.version + 1;
    const { data: approved, error: insertError } = await supabase
      .from("resume_profiles")
      .insert({
        resume_id: id,
        user_id: userId,
        version: approvedVersion,
        status: "approved",
        profile,
        schema_version: PROFILE_SCHEMA_VERSION,
        prompt_version: PROFILE_PROMPT_VERSION,
        model: null,
        source_mode: "manual",
        average_confidence: calculateAverageConfidence(profile),
        approved_at: new Date().toISOString(),
      })
      .select("id,version,status,profile,approved_at,created_at,updated_at")
      .single();
    if (insertError || !approved) {
      throw new Error("Could not approve the profile");
    }

    const { error: updateError } = await supabase
      .from("resumes")
      .update({
        status: "approved",
        processing_stage: "approved",
        latest_profile_version: approvedVersion,
        approved_profile_version: approvedVersion,
        derived_profile_version: null,
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) {
      throw new Error("Could not update the approval status");
    }

    return Response.json({ profile: approved, status: "approved" });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return unauthorized();
    }

    throw error;
  }
}
