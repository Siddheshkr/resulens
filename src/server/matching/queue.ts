import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getEmbeddingModel } from "@/server/matching/constants";
import { buildResumeEmbeddingContent, sha256Text } from "@/server/matching/content";
import type { Database, Tables, TablesInsert } from "@/lib/supabase/database.types";
import { resumeProfileSchema } from "@/lib/resumes/profile-schema";

type AdminClient = SupabaseClient<Database>;

export async function enqueueResumeEmbedding(
  admin: AdminClient,
  resumeId: string,
  userId: string,
  profileVersion: number,
) {
  const { data: profile, error: profileError } = await admin
    .from("resume_profiles")
    .select("profile")
    .eq("resume_id", resumeId)
    .eq("user_id", userId)
    .eq("version", profileVersion)
    .eq("status", "approved")
    .maybeSingle();
  if (profileError || !profile)
    throw new Error("Could not load the approved profile for embedding");

  const parsedProfile = resumeProfileSchema.parse(profile.profile);
  const contentHash = sha256Text(buildResumeEmbeddingContent(parsedProfile));
  const sourceVersion = `profile:${profileVersion}:model:${getEmbeddingModel()}:content:${contentHash}`;

  const { data: existing, error: existingError } = await admin
    .from("embedding_jobs")
    .select("id,status")
    .eq("subject_type", "resume")
    .eq("resume_id", resumeId)
    .eq("source_version", sourceVersion)
    .in("status", ["queued", "processing"])
    .maybeSingle();
  if (existingError) throw new Error("Could not check the resume embedding queue");
  if (existing) {
    if (existing.status === "queued") {
      const { error: retryQueueError } = await admin.rpc("enqueue_embedding_processing", {
        p_embedding_job_id: existing.id,
      });
      if (retryQueueError) throw new Error("Could not deliver the resume embedding job");
    }
    return existing.id;
  }

  const insert: TablesInsert<"embedding_jobs"> = {
    subject_type: "resume",
    resume_id: resumeId,
    user_id: userId,
    source_version: sourceVersion,
  };
  const { data: job, error: insertError } = await admin
    .from("embedding_jobs")
    .insert(insert)
    .select("id")
    .single();
  if (insertError || !job) throw new Error("Could not queue the resume embedding");

  const { error: queueError } = await admin.rpc("enqueue_embedding_processing", {
    p_embedding_job_id: job.id,
  });
  if (queueError) throw new Error("Could not deliver the resume embedding job");
  return job.id;
}

export async function enqueueJobEmbedding(
  admin: AdminClient,
  job: Pick<Tables<"job_postings">, "id" | "content_fingerprint">,
) {
  const sourceVersion = `content:${job.content_fingerprint}:model:${getEmbeddingModel()}`;
  const { data: existing, error: existingError } = await admin
    .from("embedding_jobs")
    .select("id,status")
    .eq("subject_type", "job")
    .eq("job_posting_id", job.id)
    .eq("source_version", sourceVersion)
    .in("status", ["queued", "processing"])
    .maybeSingle();
  if (existingError) throw new Error("Could not check the job embedding queue");
  if (existing) {
    if (existing.status === "queued") {
      const { error: retryQueueError } = await admin.rpc("enqueue_embedding_processing", {
        p_embedding_job_id: existing.id,
      });
      if (retryQueueError) throw new Error("Could not deliver the job embedding");
    }
    return existing.id;
  }

  const insert: TablesInsert<"embedding_jobs"> = {
    subject_type: "job",
    job_posting_id: job.id,
    source_version: sourceVersion,
  };
  const { data: embeddingJob, error: insertError } = await admin
    .from("embedding_jobs")
    .insert(insert)
    .select("id")
    .single();
  if (insertError || !embeddingJob) throw new Error("Could not queue the job embedding");

  const { error: queueError } = await admin.rpc("enqueue_embedding_processing", {
    p_embedding_job_id: embeddingJob.id,
  });
  if (queueError) throw new Error("Could not deliver the job embedding");
  return embeddingJob.id;
}

export async function ensureCandidatePreferences(admin: AdminClient, userId: string) {
  const selectColumns =
    "user_id,revision,country_codes,preferred_locations,workplace_types,role_exclusions,minimum_experience_years,maximum_experience_years,salary_minimum,salary_currency,work_authorization_status";
  const { data: existing, error: existingError } = await admin
    .from("candidate_preferences")
    .select(selectColumns)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw new Error("Could not load matching preferences");
  if (existing) return existing;

  const { data: preferences, error } = await admin
    .from("candidate_preferences")
    .insert({ user_id: userId })
    .select(selectColumns)
    .single();
  if (error || !preferences) {
    // A concurrent first request may have inserted the row. Read it back rather
    // than turning that harmless race into a failed match run.
    const { data: concurrent } = await admin
      .from("candidate_preferences")
      .select(selectColumns)
      .eq("user_id", userId)
      .maybeSingle();
    if (concurrent) return concurrent;
    throw new Error("Could not create matching preferences");
  }
  return preferences;
}
