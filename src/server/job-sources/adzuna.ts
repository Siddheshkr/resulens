import { z } from "zod";

import { buildNormalizedJob, optionalText, toJson } from "@/server/job-sources/common";
import { fetchJson, readConfigNumber, readConfigString } from "@/server/job-sources/http";
import { parseIsoDate } from "@/server/job-sources/sanitize";
import { JobSourceError } from "@/server/job-sources/types";
import type {
  AdapterFetchOptions,
  AdapterPage,
  JobSource,
  JobSourceAdapter,
} from "@/server/job-sources/types";

const adzunaJobSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    description: z.string().optional().default(""),
    redirect_url: z.string(),
    created: z.string().optional(),
    company: z.object({ display_name: z.string().optional() }).optional(),
    location: z
      .object({
        display_name: z.string().optional(),
        area: z.array(z.string()).optional(),
      })
      .optional(),
    contract_time: z.string().optional(),
    contract_type: z.string().optional(),
    category: z.object({ label: z.string().optional() }).optional(),
  })
  .passthrough();

const adzunaResponseSchema = z
  .object({
    results: z.array(adzunaJobSchema),
    count: z.number().optional(),
  })
  .passthrough();

function adzunaConfig(source: JobSource) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const countryCode =
    readConfigString(source.providerConfig, "countryCode") ??
    process.env.ADZUNA_COUNTRY_CODE ??
    "in";
  const query =
    readConfigString(source.providerConfig, "query") ?? process.env.ADZUNA_DEFAULT_QUERY;
  const location = readConfigString(source.providerConfig, "location");
  if (!appId || !appKey || !query) {
    throw new JobSourceError(
      "provider_unconfigured",
      "Adzuna ingestion is not configured for this source.",
    );
  }
  return { appId, appKey, countryCode, query, location };
}

async function fetchPage(source: JobSource, options: AdapterFetchOptions): Promise<AdapterPage> {
  const config = adzunaConfig(source);
  const pageSize = Math.max(1, Math.min(Math.floor(options.pageSize), 50));
  const params = new URLSearchParams({
    app_id: config.appId,
    app_key: config.appKey,
    results_per_page: String(pageSize),
    what: config.query,
    "content-type": "application/json",
  });
  if (config.location) params.set("where", config.location);
  const url = `https://api.adzuna.com/v1/api/jobs/${encodeURIComponent(config.countryCode)}/search/${options.page}?${params.toString()}`;
  const raw = await fetchJson<unknown>(url, { signal: options.signal, onRetry: options.onRetry });
  const parsed = adzunaResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new JobSourceError(
      "invalid_provider_response",
      "Adzuna returned an unexpected response.",
    );
  }
  const complete =
    parsed.data.results.length < pageSize || (parsed.data.count ?? 0) <= options.page * pageSize;
  return {
    items: parsed.data.results,
    nextPage: complete ? null : options.page + 1,
    complete,
    rawPayload: toJson(raw),
  };
}

function normalize(item: unknown, source: JobSource) {
  const parsed = adzunaJobSchema.safeParse(item);
  if (!parsed.success) {
    throw new JobSourceError("invalid_provider_record", "Adzuna returned an invalid job record.");
  }
  const locationText =
    parsed.data.location?.display_name ?? parsed.data.location?.area?.join(", ") ?? null;
  return buildNormalizedJob({
    source,
    externalJobId: String(parsed.data.id),
    title: parsed.data.title,
    description: parsed.data.description,
    locationText,
    countryCode:
      readConfigString(source.providerConfig, "countryCode") ??
      process.env.ADZUNA_COUNTRY_CODE ??
      "in",
    canonicalUrl: parsed.data.redirect_url,
    postedAt: parseIsoDate(parsed.data.created),
    companyName: parsed.data.company?.display_name,
    employmentType: parsed.data.contract_time ?? parsed.data.contract_type,
    skills: [optionalText(parsed.data.category?.label, 120)],
    rawPayload: parsed.data,
  });
}

export const adzunaAdapter: JobSourceAdapter = {
  provider: "adzuna",
  fetchPage,
  normalize,
};

export const ADZUNA_DEFAULT_PAGE_SIZE = 20;
export const ADZUNA_DEFAULT_MAX_PAGES = 5;
export const ADZUNA_DEFAULT_PAGE_SIZE_FROM_CONFIG = (source: JobSource) =>
  Math.max(
    1,
    Math.min(
      Math.floor(readConfigNumber(source.providerConfig, "pageSize", ADZUNA_DEFAULT_PAGE_SIZE)),
      50,
    ),
  );
