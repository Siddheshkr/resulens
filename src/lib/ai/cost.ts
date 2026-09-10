import { z } from "zod";

const rateSchema = z.record(
  z.string(),
  z.object({
    inputMicrousdPerMillion: z.number().nonnegative(),
    outputMicrousdPerMillion: z.number().nonnegative().default(0),
  }),
);

export function estimateAiCostMicrousd(
  model: string,
  inputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
) {
  const configured = process.env.AI_COST_RATES_JSON;
  if (!configured) return null;
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(configured);
  } catch {
    return null;
  }
  const rates = rateSchema.safeParse(parsedJson);
  const rate = rates.success ? rates.data[model] : undefined;
  if (!rate) return null;
  return Math.round(
    ((inputTokens ?? 0) * rate.inputMicrousdPerMillion +
      (outputTokens ?? 0) * rate.outputMicrousdPerMillion) /
      1_000_000,
  );
}
