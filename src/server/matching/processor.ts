import "server-only";

import { randomUUID } from "node:crypto";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resumeProfileSchema } from "@/lib/resumes/profile-schema";
import { createEmbeddings } from "@/server/matching/embeddings";
import {
  buildJobEmbeddingContent,
  buildResumeEmbeddingContent,
  formatPgVector,
  sha256Text,
  type MatchingJob,
} from "@/server/matching/content";
import { getEmbeddingModel } from "@/server/matching/constants";
import type { TablesUpdate } from "@/lib/supabase/database.types";

const MAX_ATTEMPTS = 3;

function safeError(error: unknown) {
  if (error instanceof Error && error.message.includes("OPENAI_API_KEY")) {
    return { code: "provider_unconfigured", message: "Embedding processing is not configured." };
  }
  return { code: "embedding_failed", message: "The matching signal could not be generated." };
}

type EmbeddingJob = {
  id: string;
  subject_type: string;
  resume_id: string | null;
  job_posting_id: string | null;
  user_id: string | null;
  source_version: string;
  attempt_count: number;
  status: string;
  locked_by: string | null;
};

async function processResumeEmbedding(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  job: EmbeddingJob,
) {
  if (!job.resume_id || !job.user_id) return "skipped" as const;
  const { data: resume, error: resumeError } = await admin
    .from("resumes")
    .select("id,user_id,status,approved_profile_version,deleted_at")
    .eq("id", job.resume_id)
    .eq("user_id", job.user_id)
    .maybeSingle();
  if (resumeError) throw new Error("Could not load the resume for embedding");
  if (
    !resume ||
    resume.deleted_at ||
    resume.status !== "approved" ||
    resume.approved_profile_version === null
  ) {
    return "skipped" as const;
  }

  const { data: profile, error: profileError } = await admin
    .from("resume_profiles")
    .select("profile,version,status")
    .eq("resume_id", job.resume_id)
    .eq("user_id", job.user_id)
    .eq("version", resume.approved_profile_version)
    .eq("status", "approved")
    .maybeSingle();
  if (profileError || !profile) throw new Error("Could not load the approved profile");
  const parsedProfile = resumeProfileSchema.parse(profile.profile);
  const content = buildResumeEmbeddingContent(parsedProfile);
  const contentHash = sha256Text(content);
  const expectedSourceVersion = `profile:${resume.approved_profile_version}:model:${getEmbeddingModel()}:content:${contentHash}`;
  if (job.source_version !== expectedSourceVersion) return "stale" as const;

  const { data: existing } = await admin
    .from("resume_embeddings")
    .select("id")
    .eq("resume_id", job.resume_id)
    .eq("profile_version", resume.approved_profile_version)
    .eq("model", getEmbeddingModel())
    .eq("content_hash", contentHash)
    .maybeSingle();
  if (!existing) {
    const embedding = await createEmbeddings([content]);
    const { data: currentResume } = await admin
      .from("resumes")
      .select("status,approved_profile_version,deleted_at")
      .eq("id", job.resume_id)
      .eq("user_id", job.user_id)
      .maybeSingle();
    if (
      !currentResume ||
      currentResume.deleted_at ||
      currentResume.status !== "approved" ||
      currentResume.approved_profile_version !== resume.approved_profile_version
    ) {
      return "stale" as const;
    }
    const { error: insertError } = await admin.from("resume_embeddings").upsert(
      {
        resume_id: job.resume_id,
        user_id: job.user_id,
        profile_version: resume.approved_profile_version,
        model: embedding.model,
        content_hash: contentHash,
        embedding: formatPgVector(embedding.vectors[0]),
        input_tokens: embedding.inputTokens,
        latency_ms: embedding.latencyMs,
      },
      { onConflict: "resume_id,profile_version,model,content_hash" },
    );
    if (insertError) throw new Error("Could not save the resume embedding");
  }

  await admin
    .from("resumes")
    .update({ derived_profile_version: resume.approved_profile_version })
    .eq("id", job.resume_id)
    .eq("user_id", job.user_id)
    .eq("status", "approved")
    .eq("approved_profile_version", resume.approved_profile_version);
  return "succeeded" as const;
}

async function processJobEmbedding(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  job: EmbeddingJob,
) {
  if (!job.job_posting_id) return "skipped" as const;
  const { data: posting, error: postingError } = await admin
    .from("job_postings")
    .select(
      "id,status,title,description,location_text,country_code,workplace_type,employment_type,seniority,salary_min,salary_max,salary_currency,work_authorization_support,required_experience_min_years,required_experience_max_years,content_fingerprint,posted_at,source_updated_at",
    )
    .eq("id", job.job_posting_id)
    .maybeSingle();
  if (postingError) throw new Error("Could not load the job for embedding");
  if (!posting || posting.status !== "active") return "skipped" as const;
  const { data: skillRows } = await admin
    .from("job_skills")
    .select("display_skill")
    .eq("job_posting_id", job.job_posting_id);
  const content = buildJobEmbeddingContent(
    posting as MatchingJob,
    (skillRows ?? []).map((row) => row.display_skill),
  );
  const model = getEmbeddingModel();
  const expectedSourceVersion = `content:${posting.content_fingerprint}:model:${model}`;
  if (job.source_version !== expectedSourceVersion) return "stale" as const;
  const { data: existing } = await admin
    .from("job_posting_embeddings")
    .select("job_posting_id")
    .eq("job_posting_id", job.job_posting_id)
    .eq("content_fingerprint", posting.content_fingerprint)
    .eq("model", model)
    .maybeSingle();
  if (existing) return "succeeded" as const;

  const embedding = await createEmbeddings([content]);
  const { data: currentPosting } = await admin
    .from("job_postings")
    .select("status,content_fingerprint")
    .eq("id", job.job_posting_id)
    .maybeSingle();
  if (
    !currentPosting ||
    currentPosting.status !== "active" ||
    currentPosting.content_fingerprint !== posting.content_fingerprint
  ) {
    return "stale" as const;
  }
  const { error: upsertError } = await admin.from("job_posting_embeddings").upsert(
    {
      job_posting_id: job.job_posting_id,
      model: embedding.model,
      content_fingerprint: posting.content_fingerprint,
      embedding: formatPgVector(embedding.vectors[0]),
      input_tokens: embedding.inputTokens,
      latency_ms: embedding.latencyMs,
    },
    { onConflict: "job_posting_id" },
  );
  if (upsertError) throw new Error("Could not save the job embedding");
  return "succeeded" as const;
}

export async function processEmbeddingJob(embeddingJobId: string, workerId: string = randomUUID()) {
  const admin = createAdminSupabaseClient();
  const { data: job, error: jobError } = await admin
    .from("embedding_jobs")
    .select(
      "id,subject_type,resume_id,job_posting_id,user_id,source_version,attempt_count,status,locked_by",
    )
    .eq("id", embeddingJobId)
    .in("status", ["queued", "processing"])
    .maybeSingle();
  if (jobError) throw new Error("Could not load embedding job");
  if (!job) return { status: "idle" as const };

  const typedJob = job as EmbeddingJob;
  const attemptCount = Math.min(MAX_ATTEMPTS, typedJob.attempt_count + 1);
  let lockQuery = admin
    .from("embedding_jobs")
    .update({
      status: "processing",
      attempt_count: attemptCount,
      locked_at: new Date().toISOString(),
      locked_by: workerId,
    } satisfies TablesUpdate<"embedding_jobs">)
    .eq("id", typedJob.id)
    .eq("status", typedJob.status);
  if (typedJob.status === "processing") {
    lockQuery = lockQuery.eq("locked_by", workerId);
  }
  const { data: lockedJob, error: lockError } = await lockQuery.select("id").maybeSingle();
  if (lockError) throw new Error("Could not lock the embedding job");
  if (!lockedJob) return { status: "idle" as const };
  const startedAt = Date.now();

  try {
    const status =
      typedJob.subject_type === "resume"
        ? await processResumeEmbedding(admin, typedJob)
        : await processJobEmbedding(admin, typedJob);
    await admin
      .from("embedding_jobs")
      .update({
        status: "succeeded",
        completed_at: new Date().toISOString(),
        latency_ms: Date.now() - startedAt,
        last_error_code: null,
        last_error_message: null,
      } satisfies TablesUpdate<"embedding_jobs">)
      .eq("id", typedJob.id);
    return { status };
  } catch (error) {
    const failure = safeError(error);
    const retryable = attemptCount < MAX_ATTEMPTS;
    await admin
      .from("embedding_jobs")
      .update({
        status: retryable ? "queued" : "failed",
        available_at: retryable
          ? new Date(Date.now() + attemptCount * 60_000).toISOString()
          : new Date().toISOString(),
        completed_at: retryable ? null : new Date().toISOString(),
        last_error_code: failure.code,
        last_error_message: failure.message,
        latency_ms: Date.now() - startedAt,
      } satisfies TablesUpdate<"embedding_jobs">)
      .eq("id", typedJob.id);
    return {
      status: retryable ? ("queued" as const) : ("failed" as const),
      errorCode: failure.code,
    };
  }
}
