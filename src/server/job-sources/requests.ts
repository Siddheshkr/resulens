import { z } from "zod";

export const ingestionRequestSchema = z
  .object({
    maxSources: z.number().int().min(1).max(10).optional(),
    maxPages: z.number().int().min(1).max(10).optional(),
  })
  .strict();
