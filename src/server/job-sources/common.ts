import type { Json } from "@/lib/supabase/database.types";
import {
  fingerprintJob,
  inferWorkplaceType,
  normalizeCompanyName,
  normalizeHttpsUrl,
  sanitizeProviderDescription,
} from "@/server/job-sources/sanitize";
import { JobSourceError } from "@/server/job-sources/types";
import type { JobSource, NormalizedJob } from "@/server/job-sources/types";

export function toJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJson(item));
  }
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toJson(item)]));
  }
  return String(value);
}

export function requiredText(value: unknown, field: string, maxLength = 300) {
  if (typeof value !== "string") {
    throw new JobSourceError("invalid_provider_record", `The provider omitted a valid ${field}.`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    throw new JobSourceError(
      "invalid_provider_record",
      `The provider returned an invalid ${field}.`,
    );
  }
  return trimmed;
}

export function optionalText(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null;
}

export function buildNormalizedJob(input: {
  externalJobId: unknown;
  title: unknown;
  description: unknown;
  locationText?: unknown;
  countryCode?: unknown;
  workplaceType?: "onsite" | "hybrid" | "remote" | "unknown";
  employmentType?: unknown;
  seniority?: unknown;
  canonicalUrl: unknown;
  sourceUpdatedAt?: string | null;
  postedAt?: string | null;
  expiresAt?: string | null;
  companyName?: unknown;
  companyWebsiteUrl?: unknown;
  skills?: unknown[];
  rawPayload: unknown;
  source: JobSource;
}): NormalizedJob {
  const externalJobId = requiredText(input.externalJobId, "external job id", 200);
  const title = requiredText(input.title, "title");
  const description = sanitizeProviderDescription(optionalText(input.description, 250_000) ?? "");
  if (description.length === 0) {
    throw new JobSourceError(
      "invalid_provider_record",
      "The provider returned an empty description.",
    );
  }
  const canonicalUrl = normalizeHttpsUrl(requiredText(input.canonicalUrl, "canonical URL", 2_000));
  if (!canonicalUrl) {
    throw new JobSourceError("invalid_provider_record", "The provider returned an unsafe job URL.");
  }
  const locationText = optionalText(input.locationText);
  const companyName = optionalText(input.companyName, 200);
  const normalizedCompanyName = companyName ? normalizeCompanyName(companyName) : null;
  const skills = (input.skills ?? [])
    .filter((skill): skill is string => typeof skill === "string")
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 50)
    .map((skill) => ({
      displaySkill: skill.slice(0, 160),
      normalizedSkill: normalizeCompanyName(skill),
    }))
    .filter((skill) => skill.normalizedSkill.length > 0);

  const countryCode = optionalText(input.countryCode, 2)?.toUpperCase() ?? null;
  const workplaceType = input.workplaceType ?? inferWorkplaceType(locationText);
  const contentFingerprint = fingerprintJob({
    title,
    description,
    locationText,
    companyName,
    canonicalUrl,
  });

  return {
    externalJobId,
    title,
    description,
    locationText,
    countryCode: countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null,
    workplaceType,
    employmentType: optionalText(input.employmentType, 80),
    seniority: optionalText(input.seniority, 80),
    canonicalUrl,
    sourceUpdatedAt: input.sourceUpdatedAt ?? null,
    postedAt: input.postedAt ?? null,
    expiresAt: input.expiresAt ?? null,
    status: "active",
    company:
      normalizedCompanyName && companyName
        ? {
            displayName: companyName,
            normalizedName: normalizedCompanyName,
            websiteUrl: normalizeHttpsUrl(optionalText(input.companyWebsiteUrl, 2_000) ?? ""),
          }
        : null,
    skills,
    contentFingerprint,
    rawPayload: toJson(input.rawPayload),
  };
}
