import { z } from "zod";

export const rawFileRetentionPolicySchema = z.enum(["delete_after_approval", "retain_30_days"]);

export const updateAccountSettingsSchema = z
  .object({
    rawFileRetentionPolicy: rawFileRetentionPolicySchema.optional(),
    onboardingComplete: z.boolean().optional(),
  })
  .refine(
    (value) => value.rawFileRetentionPolicy !== undefined || value.onboardingComplete !== undefined,
    "At least one setting is required",
  );

export const deleteAccountSchema = z.object({
  confirmation: z.literal("DELETE"),
});

export type RawFileRetentionPolicy = z.infer<typeof rawFileRetentionPolicySchema>;
