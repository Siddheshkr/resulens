import { getRequiredEnv } from "@/lib/config";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const MATCHING_SCORING_VERSION = "resulens-match-2026-09-09-v1";
export const MATCHING_EXPLANATION_PROMPT_VERSION = "match-explanation-2026-09-09-v1";
export const DEFAULT_EXPLANATION_MODEL = "gpt-5.6-luna";
export const MAX_MATCH_CANDIDATES = 100;
export const MAX_MATCH_RESULTS = 40;
export const MAX_EXPLANATIONS_PER_RUN = 10;
export const EMBEDDING_DIMENSIONS = 1536;

export function getEmbeddingModel() {
  return process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
}

export function getExplanationModel() {
  return process.env.OPENAI_MATCH_EXPLANATION_MODEL || DEFAULT_EXPLANATION_MODEL;
}

export function getMatchingWorkerSecret() {
  return getRequiredEnv("MATCHING_WORKER_SECRET");
}
