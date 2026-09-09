import type { Json } from "@/lib/supabase/database.types";

export const JOB_PROVIDERS = ["adzuna", "greenhouse", "lever"] as const;
export type JobProvider = (typeof JOB_PROVIDERS)[number];

export type JobSource = {
  id: string;
  provider: JobProvider;
  slug: string;
  displayName: string;
  status: "active" | "paused" | "error";
  providerConfig: Record<string, unknown>;
};

export type NormalizedCompany = {
  displayName: string;
  normalizedName: string;
  websiteUrl: string | null;
};

export type NormalizedJob = {
  externalJobId: string;
  title: string;
  description: string;
  locationText: string | null;
  countryCode: string | null;
  workplaceType: "onsite" | "hybrid" | "remote" | "unknown";
  employmentType: string | null;
  seniority: string | null;
  canonicalUrl: string;
  sourceUpdatedAt: string | null;
  postedAt: string | null;
  expiresAt: string | null;
  status: "active" | "closed" | "expired";
  company: NormalizedCompany | null;
  skills: Array<{ displaySkill: string; normalizedSkill: string }>;
  contentFingerprint: string;
  rawPayload: Json;
};

export type AdapterPage = {
  items: unknown[];
  nextPage: number | null;
  complete: boolean;
  rawPayload: Json;
};

export type AdapterFetchOptions = {
  page: number;
  pageSize: number;
  signal?: AbortSignal;
  onRetry?: () => void;
};

export type JobSourceAdapter = {
  provider: JobProvider;
  fetchPage(source: JobSource, options: AdapterFetchOptions): Promise<AdapterPage>;
  normalize(item: unknown, source: JobSource): NormalizedJob;
};

export class JobSourceError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly rateLimited: boolean;

  constructor(
    code: string,
    message: string,
    options?: { retryable?: boolean; rateLimited?: boolean },
  ) {
    super(message);
    this.name = "JobSourceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.rateLimited = options?.rateLimited ?? false;
  }
}
