import { z } from "zod";

import { buildNormalizedJob } from "@/server/job-sources/common";
import { toJson } from "@/server/job-sources/common";
import { fetchJson, readConfigString } from "@/server/job-sources/http";
import { inferWorkplaceType, parseIsoDate } from "@/server/job-sources/sanitize";
import { JobSourceError } from "@/server/job-sources/types";
import type {
  AdapterFetchOptions,
  AdapterPage,
  JobSource,
  JobSourceAdapter,
} from "@/server/job-sources/types";

const greenhouseJobSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    title: z.string(),
    updated_at: z.string().optional(),
    first_published: z.string().optional(),
    absolute_url: z.string(),
    content: z.string().optional().default(""),
    location: z.object({ name: z.string().optional() }).optional(),
    departments: z.array(z.object({ name: z.string().optional() }).passthrough()).optional(),
    offices: z
      .array(
        z.object({ name: z.string().optional(), location: z.string().optional() }).passthrough(),
      )
      .optional(),
    company_name: z.string().optional(),
  })
  .passthrough();

const greenhouseResponseSchema = z
  .object({
    jobs: z.array(greenhouseJobSchema),
    meta: z.object({ total: z.number().optional() }).optional(),
  })
  .passthrough();

function greenhouseConfig(source: JobSource) {
  const boardToken = readConfigString(source.providerConfig, "boardToken");
  if (!boardToken) {
    throw new JobSourceError(
      "provider_unconfigured",
      "Greenhouse ingestion is not configured for this source.",
    );
  }
  return {
    boardToken,
    countryCode: readConfigString(source.providerConfig, "countryCode"),
    companyName: readConfigString(source.providerConfig, "companyName") ?? source.displayName,
  };
}

async function fetchPage(source: JobSource, options: AdapterFetchOptions): Promise<AdapterPage> {
  const config = greenhouseConfig(source);
  if (options.page > 1) {
    return { items: [], nextPage: null, complete: true, rawPayload: { jobs: [] } };
  }
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(config.boardToken)}/jobs?content=true`;
  const raw = await fetchJson<unknown>(url, { signal: options.signal, onRetry: options.onRetry });
  const parsed = greenhouseResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new JobSourceError(
      "invalid_provider_response",
      "Greenhouse returned an unexpected response.",
    );
  }
  return { items: parsed.data.jobs, nextPage: null, complete: true, rawPayload: toJson(raw) };
}

function normalize(item: unknown, source: JobSource) {
  const parsed = greenhouseJobSchema.safeParse(item);
  if (!parsed.success) {
    throw new JobSourceError(
      "invalid_provider_record",
      "Greenhouse returned an invalid job record.",
    );
  }
  const config = greenhouseConfig(source);
  const locations = [
    parsed.data.location?.name,
    ...(parsed.data.offices ?? []).flatMap((office) => [office.name, office.location]),
  ].filter((location): location is string => Boolean(location?.trim()));
  const locationText = [...new Set(locations)].join(" · ") || null;
  const skills = (parsed.data.departments ?? [])
    .map((department) => department.name)
    .filter((name): name is string => Boolean(name?.trim()));
  return buildNormalizedJob({
    source,
    externalJobId: String(parsed.data.id),
    title: parsed.data.title,
    description: parsed.data.content,
    locationText,
    countryCode: config.countryCode,
    workplaceType: inferWorkplaceType(locationText),
    canonicalUrl: parsed.data.absolute_url,
    sourceUpdatedAt: parseIsoDate(parsed.data.updated_at),
    postedAt: parseIsoDate(parsed.data.first_published),
    companyName: parsed.data.company_name ?? config.companyName,
    skills,
    rawPayload: parsed.data,
  });
}

export const greenhouseAdapter: JobSourceAdapter = {
  provider: "greenhouse",
  fetchPage,
  normalize,
};
