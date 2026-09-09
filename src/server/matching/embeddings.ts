import "server-only";

import OpenAI from "openai";

import { getRequiredEnv } from "@/lib/config";
import { EMBEDDING_DIMENSIONS, getEmbeddingModel } from "@/server/matching/constants";

function getOpenAiClient() {
  return new OpenAI({
    apiKey: getRequiredEnv("OPENAI_API_KEY"),
    maxRetries: 1,
    timeout: 60_000,
  });
}

export type EmbeddingResult = {
  vectors: number[][];
  model: string;
  inputTokens: number | null;
  latencyMs: number;
};

export async function createEmbeddings(inputs: string[]): Promise<EmbeddingResult> {
  if (inputs.length === 0 || inputs.length > 32) {
    throw new Error("Embedding batch must contain between one and 32 inputs");
  }

  const model = getEmbeddingModel();
  const startedAt = Date.now();
  const response = await getOpenAiClient().embeddings.create({
    model,
    input: inputs,
    encoding_format: "float",
  });
  const vectors = response.data.map((item) => item.embedding);

  if (vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error("Embedding provider returned an unexpected vector dimension");
  }

  return {
    vectors,
    model,
    inputTokens: response.usage?.prompt_tokens ?? null,
    latencyMs: Date.now() - startedAt,
  };
}
