import "server-only";

import { randomUUID } from "node:crypto";

import { extractResumeProfile } from "@/lib/ai/resume-profile";
import {
  MAX_PROCESSING_ATTEMPTS,
  PROFILE_PROMPT_VERSION,
  PROFILE_SCHEMA_VERSION,
} from "@/lib/resumes/constants";
import { extractResumeText, PdfProcessingError } from "@/lib/resumes/pdf";
import { calculateAverageConfidence, resumeProfileSchema } from "@/lib/resumes/profile-schema";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/lib/supabase/database.types";

type ResumeUpdate = TablesUpdate<"resumes">;
type JobUpdate = TablesUpdate<"resume_processing_jobs">;

type ResumeRecord = {
  id: string;
  user_id: string;
  original_filename: string;
  storage_path: string;
  status: string;
  retry_count: number;
};

type ProcessingJob = {
  id: string;
  resume_id: string;
  attempt_count: number;
  status: string;
};

function safeError(error: unknown) {
  if (error instanceof PdfProcessingError) {
    return { code: error.code, message: error.message, retryable: false };
  }

  if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
    return {
      code: "provider_unconfigured",
      message: "Resume processing is not configured yet. Try again later.",
      retryable: false,
    };
  }

  return {
    code: "processing_failed",
    message: "We could not finish scanning this resume. Try again.",
    retryable: true,
  };
}

async function updateJob(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  jobId: string,
  values: JobUpdate,
) {
  await admin.from("resume_processing_jobs").update(values).eq("id", jobId);
}

async function updateResume(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  resumeId: string,
  values: ResumeUpdate,
) {
  await admin.from("resumes").update(values).eq("id", resumeId);
}

export async function processResume(resumeId: string, workerId?: string, jobId?: string) {
  const admin = createAdminSupabaseClient();
  const resolvedWorkerId = workerId ?? randomUUID();
  const { data: resume, error: resumeError } = await admin
    .from("resumes")
    .select("id,user_id,original_filename,storage_path,status,retry_count")
    .eq("id", resumeId)
    .maybeSingle();

  if (resumeError) {
    throw new Error("Could not load resume processing record");
  }

  if (!resume) {
    return { status: "deleted" as const };
  }

  const typedResume = resume as ResumeRecord;
  if (typedResume.status === "deleting" || typedResume.status === "deleted") {
    return { status: "deleted" as const };
  }

  let jobQuery = admin
    .from("resume_processing_jobs")
    .select("id,resume_id,attempt_count,status")
    .eq("resume_id", resumeId);
  if (jobId) {
    jobQuery = jobQuery.eq("id", jobId);
  }
  const { data: job, error: jobError } = await jobQuery
    .in("status", ["queued", "processing"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (jobError) {
    throw new Error("Could not load resume processing job");
  }

  if (!job) {
    return { status: "idle" as const };
  }

  const typedJob = job as ProcessingJob;
  const attemptCount = Math.min(MAX_PROCESSING_ATTEMPTS, typedJob.attempt_count + 1);
  await updateJob(admin, typedJob.id, {
    status: "processing",
    attempt_count: attemptCount,
    locked_at: new Date().toISOString(),
    locked_by: resolvedWorkerId,
  });
  await updateResume(admin, resumeId, {
    status: "processing",
    processing_stage: "validating",
    error_code: null,
    error_message: null,
    retry_count: Math.max(0, attemptCount - 1),
  });

  const startedAt = Date.now();

  try {
    const { data: file, error: downloadError } = await admin.storage
      .from("resumes")
      .download(typedResume.storage_path);

    if (downloadError || !file) {
      throw new PdfProcessingError(
        "malformed_pdf",
        "The uploaded PDF could not be retrieved. Upload it again.",
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    await updateResume(admin, resumeId, { processing_stage: "extracting" });
    const extraction = await extractResumeText(bytes);

    await updateResume(admin, resumeId, {
      processing_stage: "structuring",
      page_count: extraction.pageCount,
      extracted_character_count: extraction.text.length,
    });

    const result = await extractResumeProfile({
      pages: extraction.pages,
      text: extraction.text,
      filename: typedResume.original_filename,
      useVision: extraction.requiresVision,
      bytes,
    });
    const profile = resumeProfileSchema.parse(result.profile);

    // A deletion can win while the provider request is in flight. Re-read the
    // row immediately before writing any derived profile data.
    const { data: currentResume } = await admin
      .from("resumes")
      .select("status")
      .eq("id", resumeId)
      .maybeSingle();

    if (
      !currentResume ||
      currentResume.status === "deleting" ||
      currentResume.status === "deleted"
    ) {
      await updateJob(admin, typedJob.id, {
        status: "succeeded",
        completed_at: new Date().toISOString(),
        last_error_code: null,
        last_error_message: null,
      });
      return { status: "deleted" as const };
    }

    const { data: latestProfile } = await admin
      .from("resume_profiles")
      .select("version")
      .eq("resume_id", resumeId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (latestProfile?.version ?? 0) + 1;

    const { error: profileError } = await admin.from("resume_profiles").insert({
      resume_id: resumeId,
      user_id: typedResume.user_id,
      version: nextVersion,
      status: "draft",
      profile,
      schema_version: PROFILE_SCHEMA_VERSION,
      prompt_version: PROFILE_PROMPT_VERSION,
      model: result.model,
      source_mode: result.sourceMode,
      average_confidence: calculateAverageConfidence(profile),
    });

    if (profileError) {
      throw new Error("Could not save the extracted profile");
    }

    await updateResume(admin, resumeId, {
      status: "needs_review",
      processing_stage: "review",
      latest_profile_version: nextVersion,
      derived_profile_version: null,
      error_code: null,
      error_message: null,
    });
    await updateJob(admin, typedJob.id, {
      status: "succeeded",
      completed_at: new Date().toISOString(),
      provider_model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      latency_ms: Date.now() - startedAt,
      last_error_code: null,
      last_error_message: null,
    });

    return { status: "needs_review" as const, profileVersion: nextVersion };
  } catch (error) {
    const failure = safeError(error);
    const retryable = failure.retryable && attemptCount < MAX_PROCESSING_ATTEMPTS;
    const nextRetryAt = retryable
      ? new Date(Date.now() + 60_000 * attemptCount).toISOString()
      : null;

    await updateJob(admin, typedJob.id, {
      status: retryable ? "queued" : "failed",
      available_at: nextRetryAt ?? new Date().toISOString(),
      completed_at: retryable ? null : new Date().toISOString(),
      last_error_code: failure.code,
      last_error_message: failure.message,
      latency_ms: Date.now() - startedAt,
    });
    await updateResume(admin, resumeId, {
      status: retryable ? "queued" : "failed",
      processing_stage: retryable ? "queued" : "failed",
      next_retry_at: nextRetryAt,
      error_code: failure.code,
      error_message: failure.message,
    });

    return {
      status: retryable ? ("queued" as const) : ("failed" as const),
      errorCode: failure.code,
    };
  }
}
