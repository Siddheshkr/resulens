import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { MAX_PROCESSING_ATTEMPTS, MAX_RESUME_BYTES } from "@/lib/resumes/constants";
import { completeResumeUploadSchema } from "@/lib/resumes/requests";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enqueueResumeProcessing } from "@/server/resumes/queue";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const storageMetadataSchema = z.object({
  size: z.number().int().positive().max(MAX_RESUME_BYTES),
  mimetype: z.literal("application/pdf"),
});

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { userId } = await requireUser();
    const { id } = await context.params;
    const body = completeResumeUploadSchema.safeParse(await request.json().catch(() => null));

    if (!body.success) {
      return Response.json({ error: "The upload size is invalid." }, { status: 400 });
    }

    const rate = checkRateLimit(`resume-complete:${userId}`, 5, 60_000);
    if (!rate.allowed) {
      return Response.json(
        { error: "Too many processing requests. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const supabase = await createServerSupabaseClient();
    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select("id,storage_path,byte_size,status,retry_count")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (resumeError) {
      throw new Error("Could not verify the resume upload");
    }

    if (!resume) {
      return Response.json({ error: "Resume not found" }, { status: 404 });
    }

    if (body.data.byteSize !== resume.byte_size) {
      return Response.json(
        { error: "The uploaded file size did not match the selected PDF." },
        { status: 400 },
      );
    }

    if (resume.status !== "pending_upload" && resume.status !== "failed") {
      return Response.json({ status: resume.status });
    }

    if (resume.status === "failed" && resume.retry_count >= MAX_PROCESSING_ATTEMPTS) {
      return Response.json({ error: "This resume has reached its retry limit." }, { status: 409 });
    }

    const admin = createAdminSupabaseClient();
    const pathSeparator = resume.storage_path.lastIndexOf("/");
    const storageFolder = resume.storage_path.slice(0, pathSeparator);
    const storageFilename = resume.storage_path.slice(pathSeparator + 1);
    const { data: storedObjects, error: storageError } = await admin.storage
      .from("resumes")
      .list(storageFolder, { search: storageFilename, limit: 10 });
    const storedObject = storedObjects?.find((object) => object.name === storageFilename);
    const storedMetadata = storageMetadataSchema.safeParse(storedObject?.metadata);
    if (storageError || !storedObject || !storedMetadata.success) {
      return Response.json(
        { error: "The PDF upload could not be verified. Upload the file again." },
        { status: 400 },
      );
    }
    if (storedMetadata.data.size !== resume.byte_size) {
      return Response.json(
        { error: "The uploaded file size did not match the selected PDF." },
        { status: 400 },
      );
    }

    const { error: updateError } = await admin
      .from("resumes")
      .update({
        status: "queued",
        processing_stage: "queued",
        upload_completed_at: new Date().toISOString(),
        error_code: null,
        error_message: null,
        next_retry_at: null,
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (updateError) {
      throw new Error("Could not queue the resume");
    }

    const { data: job, error: queueError } = await admin
      .from("resume_processing_jobs")
      .insert({
        resume_id: id,
        user_id: userId,
        kind: "extract_profile",
        status: "queued",
      })
      .select("id")
      .single();

    if (queueError && queueError.code !== "23505") {
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
      throw new Error("Could not queue the resume");
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
        throw new Error("Could not queue the resume");
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
