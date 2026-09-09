import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select(
        "id,original_filename,byte_size,status,processing_stage,page_count,extracted_character_count,latest_profile_version,approved_profile_version,error_code,error_message,created_at,updated_at",
      )
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (resumeError) {
      throw new Error("Could not load resume status");
    }

    if (!resume) {
      return Response.json({ error: "Resume not found" }, { status: 404 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("resume_profiles")
      .select(
        "id,version,status,profile,schema_version,prompt_version,model,source_mode,average_confidence,approved_at,created_at,updated_at",
      )
      .eq("resume_id", id)
      .eq("user_id", userId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (profileError) {
      throw new Error("Could not load the resume profile");
    }

    return Response.json({ resume, profile: profile ?? null });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return unauthorized();
    }

    throw error;
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await context.params;
    const supabase = await createServerSupabaseClient();
    const { data: resume, error: loadError } = await supabase
      .from("resumes")
      .select("id,storage_path,status")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (loadError) {
      throw new Error("Could not load the resume for deletion");
    }

    if (!resume) {
      return Response.json({ error: "Resume not found" }, { status: 404 });
    }

    if (resume.status === "deleted" || resume.status === "deleting") {
      return Response.json({ status: resume.status });
    }

    const { error: markDeletingError } = await supabase
      .from("resumes")
      .update({ status: "deleting", processing_stage: "deleting" })
      .eq("id", id)
      .eq("user_id", userId);
    if (markDeletingError) {
      throw new Error("Could not start resume deletion");
    }

    const admin = createAdminSupabaseClient();
    const { error: storageError } = await admin.storage
      .from("resumes")
      .remove([resume.storage_path]);
    if (storageError) {
      await supabase
        .from("resumes")
        .update({
          status: "delete_failed",
          processing_stage: "deleting",
          error_code: "storage_delete_failed",
          error_message: "The uploaded file could not be deleted. Try again.",
        })
        .eq("id", id)
        .eq("user_id", userId);
      return Response.json(
        { error: "The uploaded file could not be deleted. Try again." },
        { status: 503 },
      );
    }

    const { error: deleteError } = await admin
      .from("resumes")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);
    if (deleteError) {
      await supabase
        .from("resumes")
        .update({
          status: "delete_failed",
          processing_stage: "deleting",
          error_code: "record_delete_failed",
          error_message: "The resume data could not be deleted. Try again.",
        })
        .eq("id", id)
        .eq("user_id", userId);
      return Response.json(
        { error: "The resume data could not be deleted. Try again." },
        { status: 503 },
      );
    }

    return Response.json({ status: "deleted" });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return unauthorized();
    }

    throw error;
  }
}
