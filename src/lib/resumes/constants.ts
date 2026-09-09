export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_PAGES = 5;
export const MAX_RESUME_SCANS_PER_DAY = 3;
export const MAX_RESUME_BYTES_PER_DAY = 15 * 1024 * 1024;
export const MAX_PROCESSING_ATTEMPTS = 3;
export const MIN_EXTRACTED_TEXT_CHARACTERS = 120;
export const PROFILE_SCHEMA_VERSION = "1.0";
export const PROFILE_PROMPT_VERSION = "resume-profile-2026-09-09";
export const DEFAULT_RESUME_MODEL = "gpt-5.6-luna";
export const ESCALATION_RESUME_MODEL = "gpt-5.6-terra";

export const RESUME_STATUSES = [
  "pending_upload",
  "uploaded",
  "queued",
  "processing",
  "needs_review",
  "approved",
  "failed",
  "deleting",
  "delete_failed",
  "deleted",
] as const;

export type ResumeStatus = (typeof RESUME_STATUSES)[number];

export const RESUME_PROCESSING_STAGES = [
  "upload",
  "queued",
  "validating",
  "extracting",
  "structuring",
  "review",
  "approved",
  "deleting",
  "complete",
  "failed",
] as const;

export type ResumeProcessingStage = (typeof RESUME_PROCESSING_STAGES)[number];

export function isResumeTerminal(status: ResumeStatus) {
  return (
    status === "needs_review" ||
    status === "approved" ||
    status === "failed" ||
    status === "deleted"
  );
}
