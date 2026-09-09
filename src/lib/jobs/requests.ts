import { z } from "zod";

export const jobListQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/u)
    .optional(),
  workplace: z.enum(["onsite", "hybrid", "remote", "unknown"]).optional(),
  page: z.coerce.number().int().min(1).max(100).optional().default(1),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;
