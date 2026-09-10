import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { getRequiredEnv } from "@/lib/config";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resumeProfileSchema } from "@/lib/resumes/profile-schema";
import {
  getExplanationModel,
  MATCHING_EXPLANATION_PROMPT_VERSION,
  MAX_EXPLANATIONS_PER_RUN,
} from "@/server/matching/constants";
import { sha256Text } from "@/server/matching/content";

const evidenceSchema = z.object({
  source: z.enum(["resume", "job"]),
  quote: z.string().trim().min(1).max(240),
});

export const matchExplanationSchema = z.object({
  summary: z.string().trim().min(1).max(360),
  strengths: z
    .array(
      z.object({
        claim: z.string().trim().min(1).max(240),
        evidence: z.array(evidenceSchema).max(3),
      }),
    )
    .max(4),
  gaps: z
    .array(
      z.object({
        claim: z.string().trim().min(1).max(240),
        evidence: z.array(evidenceSchema).max(3),
      }),
    )
    .max(4),
  unknowns: z.array(z.string().trim().min(1).max(240)).max(4),
});

export type MatchExplanation = z.infer<typeof matchExplanationSchema>;

const EXPLANATION_INSTRUCTIONS = `You explain a ResuLens match score using only the supplied resume evidence, job evidence, and deterministic score breakdown. Do not invent qualifications, work authorization, salary, dates, or employer requirements. Treat missing information as unknown, never as a conflict or confirmation. Keep the summary concise. Every evidence quote must be copied exactly from the supplied evidence and remain under 240 characters. Do not mention contact details or expose personal identifiers.`;

function getOpenAiClient() {
  return new OpenAI({
    apiKey: getRequiredEnv("OPENAI_API_KEY"),
    maxRetries: 1,
    timeout: 60_000,
  });
}

function normalized(value: string) {
  return value.toLowerCase().replace(/\s+/gu, " ").trim();
}

function evidenceIsGrounded(
  explanation: MatchExplanation,
  resumeEvidence: string[],
  jobEvidence: string[],
) {
  const sourceText = {
    resume: resumeEvidence.map(normalized),
    job: jobEvidence.map(normalized),
  };
  return [...explanation.strengths, ...explanation.gaps].every((item) =>
    item.evidence.every((evidence) =>
      sourceText[evidence.source].some((source) => source.includes(normalized(evidence.quote))),
    ),
  );
}

function buildResumeEvidence(profile: z.infer<typeof resumeProfileSchema>) {
  return [
    ...profile.skills.flatMap((skill) => [
      skill.name,
      ...skill.evidence.map((item) => item.excerpt),
    ]),
    ...profile.experiences.flatMap((experience) => [
      experience.title ?? "",
      ...experience.bullets,
      ...experience.evidence.map((item) => item.excerpt),
    ]),
    ...profile.achievements.flatMap((achievement) => [
      achievement.statement,
      ...achievement.evidence.map((item) => item.excerpt),
    ]),
  ]
    .filter(Boolean)
    .slice(0, 80);
}

export async function generateMatchExplanation(userId: string, runId: string, jobMatchId: string) {
  const admin = createAdminSupabaseClient();
  const { data: match, error: matchError } = await admin
    .from("job_matches")
    .select(
      "id,match_run_id,user_id,job_posting_id,match_score,score_breakdown,eligibility,evidence,job_content_fingerprint",
    )
    .eq("id", jobMatchId)
    .eq("match_run_id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (matchError || !match) throw new Error("Match result not found");

  const { data: run, error: runError } = await admin
    .from("match_runs")
    .select("resume_id,resume_profile_version,scoring_version")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (runError || !run) throw new Error("Match run not found");

  const [{ data: profileRow, error: profileError }, { data: job, error: jobError }] =
    await Promise.all([
      admin
        .from("resume_profiles")
        .select("profile")
        .eq("resume_id", run.resume_id)
        .eq("user_id", userId)
        .eq("version", run.resume_profile_version)
        .eq("status", "approved")
        .maybeSingle(),
      admin
        .from("job_postings")
        .select("id,title,description,location_text,workplace_type,seniority,content_fingerprint")
        .eq("id", match.job_posting_id)
        .maybeSingle(),
    ]);
  if (profileError || !profileRow || jobError || !job)
    throw new Error("Could not load explanation evidence");
  const profile = resumeProfileSchema.parse(profileRow.profile);
  const resumeEvidence = buildResumeEvidence(profile);
  const jobEvidence = [
    job.title,
    job.description.slice(0, 6_000),
    job.location_text ?? "",
    job.workplace_type,
    job.seniority ?? "",
  ].filter(Boolean);
  const model = getExplanationModel();
  const inputHash = sha256Text(
    JSON.stringify({
      runId,
      jobMatchId,
      resumeProfileVersion: run.resume_profile_version,
      jobContentFingerprint: match.job_content_fingerprint,
      scoringVersion: run.scoring_version,
      model,
      promptVersion: MATCHING_EXPLANATION_PROMPT_VERSION,
      scoreBreakdown: match.score_breakdown,
      eligibility: match.eligibility,
      evidence: match.evidence,
    }),
  );

  const { data: cached } = await admin
    .from("job_match_explanations")
    .select("id,status,explanation,error_message")
    .eq("job_match_id", jobMatchId)
    .eq("input_hash", inputHash)
    .maybeSingle();
  // Successful explanations are immutable cache hits for these input versions.
  // Failed attempts remain retryable without hiding the ranked match result.
  if (cached?.status === "succeeded") return cached;

  const { data: pending, error: pendingError } = await admin
    .from("job_match_explanations")
    .upsert(
      {
        job_match_id: jobMatchId,
        match_run_id: runId,
        user_id: userId,
        job_posting_id: match.job_posting_id,
        input_hash: inputHash,
        status: "pending",
        prompt_version: MATCHING_EXPLANATION_PROMPT_VERSION,
      },
      { onConflict: "job_match_id,input_hash" },
    )
    .select("id")
    .single();
  if (pendingError || !pending) throw new Error("Could not create the explanation record");

  const startedAt = Date.now();
  try {
    const response = await getOpenAiClient().responses.parse({
      model,
      store: false,
      max_output_tokens: 1_200,
      instructions: EXPLANATION_INSTRUCTIONS,
      input: JSON.stringify({
        scoreLabel: "ResuLens match score",
        matchScore: match.match_score,
        scoreBreakdown: match.score_breakdown,
        eligibility: match.eligibility,
        storedEvidence: match.evidence,
        resumeEvidence,
        job: { title: job.title, evidence: jobEvidence },
      }),
      text: { format: zodTextFormat(matchExplanationSchema, "match_explanation") },
    });
    if (!response.output_parsed) throw new Error("No explanation returned");
    const explanation = matchExplanationSchema.parse(response.output_parsed);
    if (!evidenceIsGrounded(explanation, resumeEvidence, jobEvidence)) {
      throw new Error("Explanation evidence was not grounded");
    }
    const { data: saved, error: saveError } = await admin
      .from("job_match_explanations")
      .update({
        status: "succeeded",
        model,
        explanation,
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        latency_ms: Date.now() - startedAt,
        error_code: null,
        error_message: null,
      })
      .eq("id", pending.id)
      .select("id,status,explanation,error_message")
      .single();
    if (saveError || !saved) throw new Error("Could not save the explanation");
    return saved;
  } catch (error) {
    const { data: failed } = await admin
      .from("job_match_explanations")
      .update({
        status: "failed",
        model,
        error_code:
          error instanceof Error && error.message.includes("OPENAI_API_KEY")
            ? "provider_unconfigured"
            : "explanation_failed",
        error_message:
          "An explanation is temporarily unavailable. The ranked result is still valid.",
        latency_ms: Date.now() - startedAt,
      })
      .eq("id", pending.id)
      .select("id,status,explanation,error_message")
      .single();
    return (
      failed ?? {
        id: pending.id,
        status: "failed",
        explanation: null,
        error_message:
          "An explanation is temporarily unavailable. The ranked result is still valid.",
      }
    );
  }
}

export async function generateTopMatchExplanations(userId: string, runId: string) {
  const admin = createAdminSupabaseClient();
  const { data: matches, error } = await admin
    .from("job_matches")
    .select("id")
    .eq("match_run_id", runId)
    .eq("user_id", userId)
    .order("rank", { ascending: true })
    .limit(MAX_EXPLANATIONS_PER_RUN);
  if (error) throw new Error("Could not load top matches");

  const { error: statusError } = await admin
    .from("match_runs")
    .update({ explanation_status: "processing" })
    .eq("id", runId)
    .eq("user_id", userId);
  if (statusError) throw new Error("Could not start top-match explanations");

  const results = [];
  for (const match of matches ?? []) {
    results.push(await generateMatchExplanation(userId, runId, match.id));
  }
  await admin
    .from("match_runs")
    .update({
      explanation_status: results.every((result) => result.status === "succeeded")
        ? "complete"
        : "partial",
    })
    .eq("id", runId)
    .eq("user_id", userId);
  return results;
}
