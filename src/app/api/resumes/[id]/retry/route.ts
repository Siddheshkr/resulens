import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { MAX_PROCESSING_ATTEMPTS } from "@/lib/resumes/constants";
import { retryResumeSchema } from "@/lib/resumes/requests";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enqueueResumeProcessing } from "@/server/resumes/queue";

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await context.params;
    const body = retryResumeSchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) {
      return Response.json({ error: "The retry request is invalid." }, { status: 400 });
    }

    const rate = checkRateLimit(`resume-retry:${userId}`, 3, 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "Too many retry requests. Try again shortly." },
        { status: 429 },
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select("id,status,retry_count,storage_path")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (resumeError) {
      throw new Error("Could not load the resume");
    }
    if (!resume) {
      return Response.json({ error: "Resume not found" }, { status: 404 });
    }
    if (resume.status === "delete_failed" || resume.status === "deleting") {
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
    }

    if (resume.status !== "failed") {
      return Response.json({ status: resume.status });
    }
    if (resume.retry_count >= MAX_PROCESSING_ATTEMPTS) {
      return Response.json({ error: "This resume has reached its retry limit." }, { status: 409 });
    }

    const admin = createAdminSupabaseClient();
    const { error: updateError } = await admin
      .from("resumes")
      .update({
        status: "queued",
        processing_stage: "queued",
        error_code: null,
        error_message: null,
        next_retry_at: null,
      })
      .eq("id", id)
      .eq("user_id", userId);
    if (updateError) {
      throw new Error("Could not retry the resume");
    }

    const { data: job, error: queueError } = await admin
      .from("resume_processing_jobs")
      .insert({
        resume_id: id,
        user_id: userId,
        kind: "extract_profile",
        status: "queued",
        last_error_message: body.data.reason ?? null,
      })
      .select("id")
      .single();
    if (queueError && queueError.code !== "23505") {
      throw new Error("Could not queue the resume retry");
    }

    if (job) {
      try {
        await enqueueResumeProcessing(admin, { resumeId: id, jobId: job.id });
      } catch {
        await admin
          .from("resume_processing_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            last_error_code: "queue_unavailable",
            last_error_message: "Resume processing could not be queued. Try again.",
          })
          .eq("id", job.id);
        await admin
          .from("resumes")
          .update({
            status: "failed",
            processing_stage: "failed",
            error_code: "queue_unavailable",
            error_message: "Resume processing could not be queued. Try again.",
          })
          .eq("id", id)
          .eq("user_id", userId);
        throw new Error("Could not queue the resume retry");
      }
    }

    return Response.json({ status: "queued" });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return unauthorized();
    }

    throw error;
  }
}
