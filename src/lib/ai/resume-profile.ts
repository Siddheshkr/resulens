import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type {
  ResponseInput,
  ResponseInputMessageContentList,
} from "openai/resources/responses/responses";

import {
  DEFAULT_RESUME_MODEL,
  ESCALATION_RESUME_MODEL,
  PROFILE_PROMPT_VERSION,
  PROFILE_SCHEMA_VERSION,
} from "@/lib/resumes/constants";
import { resumeProfileSchema, type ResumeProfile } from "@/lib/resumes/profile-schema";
import { getRequiredEnv } from "@/lib/config";

const EXTRACTION_INSTRUCTIONS = `You extract a candidate profile from a resume. Return only facts supported by the provided resume. Never guess, infer a missing date, invent a skill, or fill a missing contact field. Use null or an empty array when the resume does not provide a value. Every evidence excerpt must be short, copied from the resume, and associated with the page number. Confidence is a number between 0 and 1 and reflects how directly the source supports the value. Warnings should describe ambiguity or missing information for the user to review. Keep all arrays bounded and concise.`;

export const resumeProfilePromptVersion = PROFILE_PROMPT_VERSION;
export const resumeProfileSchemaVersion = PROFILE_SCHEMA_VERSION;

type ExtractResumeProfileInput = {
  pages: string[];
  text: string;
  filename: string;
  useVision: boolean;
  bytes?: Uint8Array;
};

export type ResumeProfileResult = {
  profile: ResumeProfile;
  model: string;
  sourceMode: "text" | "vision";
  inputTokens: number | null;
  outputTokens: number | null;
};

function getOpenAiClient() {
  return new OpenAI({
    apiKey: getRequiredEnv("OPENAI_API_KEY"),
    maxRetries: 1,
    timeout: 90_000,
  });
}

function pageContext(pages: string[]) {
  return pages
    .map((page, index) => `[Page ${index + 1}]\n${page || "(no extractable text)"}`)
    .join("\n\n");
}

export async function extractResumeProfile(
  input: ExtractResumeProfileInput,
): Promise<ResumeProfileResult> {
  const model = input.useVision
    ? process.env.OPENAI_RESUME_ESCALATION_MODEL || ESCALATION_RESUME_MODEL
    : process.env.OPENAI_RESUME_MODEL || DEFAULT_RESUME_MODEL;
  const client = getOpenAiClient();

  const userContent: string | ResponseInputMessageContentList = input.useVision
    ? [
        {
          type: "input_text" as const,
          text: `${EXTRACTION_INSTRUCTIONS}\n\nThe PDF is image-based. Inspect every page visually and use page references in evidence. File name: ${input.filename}`,
        },
        {
          type: "input_file" as const,
          filename: input.filename,
          file_data: `data:application/pdf;base64,${Buffer.from(input.bytes ?? new Uint8Array()).toString("base64")}`,
          detail: "high" as const,
        },
      ]
    : `${EXTRACTION_INSTRUCTIONS}\n\nFile name: ${input.filename}\n\n${pageContext(input.pages)}\n\nNormalized character count: ${input.text.length}`;

  const modelInput: string | ResponseInput = input.useVision
    ? [{ role: "user", content: userContent as ResponseInputMessageContentList }]
    : (userContent as string);

  const response = await client.responses.parse({
    model,
    store: false,
    max_output_tokens: 3000,
    instructions: EXTRACTION_INSTRUCTIONS,
    input: modelInput,
    text: {
      format: zodTextFormat(resumeProfileSchema, "resume_profile"),
    },
  });

  if (!response.output_parsed) {
    throw new Error("Resume extraction returned no structured profile");
  }

  const profile = resumeProfileSchema.parse(response.output_parsed);
  return {
    profile,
    model,
    sourceMode: input.useVision ? "vision" : "text",
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  };
}
