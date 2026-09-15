import { z } from "zod";

const boundedStringArray = z.array(z.string().trim().min(1).max(120)).max(20);

export const preferencesSchema = z.object({
  countryCodes: z.array(z.string().trim().length(2).toUpperCase()).max(10).default(["IN"]),
  preferredLocations: boundedStringArray.default([]),
  workplaceTypes: z
    .array(z.enum(["remote", "hybrid", "onsite", "unknown"]))
    .max(4)
    .default([]),
  roleExclusions: boundedStringArray.default([]),
  minimumExperienceYears: z.number().min(0).max(80).nullable().default(null),
  maximumExperienceYears: z.number().min(0).max(80).nullable().default(null),
  salaryMinimum: z.number().min(0).max(100_000_000).nullable().default(null),
  salaryCurrency: z.string().trim().length(3).toUpperCase().nullable().default(null),
  workAuthorizationStatus: z
    .enum(["authorized", "needs_sponsorship", "unknown"])
    .default("unknown"),
});

export const createMatchRunSchema = z.object({
  resumeId: z.string().uuid(),
  preferences: preferencesSchema.partial().optional(),
  retry: z.boolean().optional().default(false),
});

export const jobActionSchema = z.object({
  state: z.enum(["saved", "dismissed", "applied"]),
  matchRunId: z.string().uuid().optional(),
});

export const jobFeedbackSchema = z.object({
  label: z.enum(["relevant", "not_relevant"]),
  note: z.string().trim().max(500).optional(),
  matchRunId: z.string().uuid().optional(),
});

export const explanationRequestSchema = z.object({
  jobMatchId: z.string().uuid().optional(),
});

export const embeddingWorkerRequestSchema = z.object({
  embeddingJobId: z.string().uuid(),
});

export type PreferencesInput = z.infer<typeof preferencesSchema>;
