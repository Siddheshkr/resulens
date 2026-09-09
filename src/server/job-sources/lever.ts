import { z } from "zod";

import { buildNormalizedJob } from "@/server/job-sources/common";
import { toJson } from "@/server/job-sources/common";
import { fetchJson, readConfigNumber, readConfigString } from "@/server/job-sources/http";
import { inferWorkplaceType, parseEpochDate } from "@/server/job-sources/sanitize";
import { JobSourceError } from "@/server/job-sources/types";
import type {
  AdapterFetchOptions,
  AdapterPage,
  JobSource,
  JobSourceAdapter,
} from "@/server/job-sources/types";

const leverJobSchema = z
  .object({
    id: z.string(),
    text: z.string(),
    description: z.string().optional().default(""),
    descriptionPlain: z.string().optional(),
    hostedUrl: z.string().optional(),
    applyUrl: z.string().optional(),
    createdAt: z.union([z.string(), z.number()]).optional(),
    updatedAt: z.union([z.string(), z.number()]).optional(),
    categories: z
      .object({
        location: z.string().optional(),
        allLocations: z.array(z.string()).optional(),
        commitment: z.string().optional(),
        team: z.string().optional(),
        department: z.string().optional(),
        level: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

const leverResponseSchema = z.array(leverJobSchema);

function leverConfig(source: JobSource) {
  const site = readConfigString(source.providerConfig, "site");
  if (!site) {
    throw new JobSourceError(
      "provider_unconfigured",
      "Lever ingestion is not configured for this source.",
    );
  }
  const region = readConfigString(source.providerConfig, "region") === "eu" ? "eu" : "global";
  return {
    site,
    region,
    countryCode: readConfigString(source.providerConfig, "countryCode"),
    companyName: readConfigString(source.providerConfig, "companyName") ?? source.displayName,
  };
}

async function fetchPage(source: JobSource, options: AdapterFetchOptions): Promise<AdapterPage> {
  const config = leverConfig(source);
  const pageSize = Math.max(1, Math.min(Math.floor(options.pageSize), 100));
  const skip = (options.page - 1) * pageSize;
  const host = config.region === "eu" ? "api.eu.lever.co" : "api.lever.co";
  const params = new URLSearchParams({ mode: "json", skip: String(skip), limit: String(pageSize) });
  const url = `https://${host}/v0/postings/${encodeURIComponent(config.site)}?${params.toString()}`;
  const raw = await fetchJson<unknown>(url, { signal: options.signal, onRetry: options.onRetry });
  const parsed = leverResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new JobSourceError("invalid_provider_response", "Lever returned an unexpected response.");
  }
  const complete = parsed.data.length < pageSize;
  return {
    items: parsed.data,
    nextPage: complete ? null : options.page + 1,
    complete,
    rawPayload: toJson(raw),
  };
}

function normalize(item: unknown, source: JobSource) {
  const parsed = leverJobSchema.safeParse(item);
  if (!parsed.success) {
    throw new JobSourceError("invalid_provider_record", "Lever returned an invalid job record.");
  }
  const config = leverConfig(source);
  const categories = parsed.data.categories;
  const locations = [categories?.location, ...(categories?.allLocations ?? [])].filter(
    (location): location is string => Boolean(location?.trim()),
  );
  const locationText = [...new Set(locations)].join(" · ") || null;
  return buildNormalizedJob({
    source,
    externalJobId: parsed.data.id,
    title: parsed.data.text,
    description: parsed.data.descriptionPlain ?? parsed.data.description,
    locationText,
    countryCode: config.countryCode,
    workplaceType: inferWorkplaceType(locationText),
    employmentType: categories?.commitment,
    seniority: categories?.level,
    canonicalUrl: parsed.data.hostedUrl ?? parsed.data.applyUrl ?? "",
    sourceUpdatedAt: parseEpochDate(parsed.data.updatedAt),
    postedAt: parseEpochDate(parsed.data.createdAt),
    companyName: config.companyName,
    skills: [categories?.team, categories?.department],
    rawPayload: parsed.data,
  });
}

export const leverAdapter: JobSourceAdapter = {
  provider: "lever",
  fetchPage,
  normalize,
};

export const LEVER_DEFAULT_PAGE_SIZE = 50;
export const LEVER_DEFAULT_PAGE_SIZE_FROM_CONFIG = (source: JobSource) =>
  Math.max(
    1,
    Math.min(
      Math.floor(readConfigNumber(source.providerConfig, "pageSize", LEVER_DEFAULT_PAGE_SIZE)),
      100,
    ),
  );
