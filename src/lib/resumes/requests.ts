import { z } from "zod";

export const createResumeUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.literal("application/pdf"),
  byteSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
  aiProcessingConsent: z.literal(true),
});

export const completeResumeUploadSchema = z.object({
  byteSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024),
});

export const workerRequestSchema = z.object({
  resumeId: z.string().uuid(),
  jobId: z.string().uuid(),
});

export const retryResumeSchema = z.object({
  reason: z.string().trim().max(200).optional(),
});

export type CreateResumeUploadInput = z.infer<typeof createResumeUploadSchema>;
export type CompleteResumeUploadInput = z.infer<typeof completeResumeUploadSchema>;
export type RetryResumeInput = z.infer<typeof retryResumeSchema>;
export type WorkerRequest = z.infer<typeof workerRequestSchema>;
