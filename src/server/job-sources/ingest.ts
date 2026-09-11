import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Tables, TablesInsert, TablesUpdate } from "@/lib/supabase/database.types";
import { ADZUNA_DEFAULT_PAGE_SIZE_FROM_CONFIG } from "@/server/job-sources/adzuna";
import { getJobSourceAdapter } from "@/server/job-sources/registry";
import { JobSourceError } from "@/server/job-sources/types";
import type { JobSource, NormalizedJob } from "@/server/job-sources/types";
import { enqueueJobEmbedding } from "@/server/matching/queue";

const DEFAULT_MAX_PAGES = 5;
const DEFAULT_PAGE_SIZE = 50;

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;
type JobSourceRow = Tables<"job_sources">;

export type IngestionSummary = {
  sourceId: string;
  sourceSlug: string;
  provider: string;
  runId: string;
  status: "succeeded" | "partial" | "failed";
  pagesFetched: number;
  recordsSeen: number;
  recordsUpserted: number;
  recordsFailed: number;
  isComplete: boolean;
  errorCode: string | null;
};

export type IngestionOptions = {
  maxPages?: number;
  pageSize?: number;
  signal?: AbortSignal;
  now?: () => Date;
};

function asSource(row: JobSourceRow): JobSource {
  const config =
    row.provider_config &&
    typeof row.provider_config === "object" &&
    !Array.isArray(row.provider_config)
      ? row.provider_config
      : {};
  if (row.provider !== "adzuna" && row.provider !== "greenhouse" && row.provider !== "lever") {
    throw new JobSourceError("unsupported_provider", "This job provider is not supported.");
  }
  if (row.status !== "active" && row.status !== "paused" && row.status !== "error") {
    throw new JobSourceError("invalid_source", "This job source has an invalid status.");
  }
  return {
    id: row.id,
    provider: row.provider,
    slug: row.slug,
    displayName: row.display_name,
    status: row.status,
    providerConfig: config,
  };
}

function readPositiveInteger(value: unknown, fallback: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(Math.floor(numeric), max));
}

function defaultPageSize(source: JobSource) {
  if (source.provider === "adzuna") return ADZUNA_DEFAULT_PAGE_SIZE_FROM_CONFIG(source);
  const configured = source.providerConfig.pageSize;
  return readPositiveInteger(configured, DEFAULT_PAGE_SIZE, 100);
}

async function writeJob(admin: AdminClient, source: JobSource, job: NormalizedJob, seenAt: string) {
  let companyId: string | null = null;
  if (job.company) {
    const company: TablesInsert<"companies"> = {
      display_name: job.company.displayName,
      normalized_name: job.company.normalizedName,
      website_url: job.company.websiteUrl,
    };
    const { data, error } = await admin
      .from("companies")
      .upsert(company, { onConflict: "normalized_name" })
      .select("id")
      .single();
    if (error || !data) throw new Error("Could not save normalized company data");
    companyId = data.id;
  }

  const posting: TablesInsert<"job_postings"> = {
    source_id: source.id,
    external_job_id: job.externalJobId,
    company_id: companyId,
    title: job.title,
    description: job.description,
    location_text: job.locationText,
    country_code: job.countryCode,
    workplace_type: job.workplaceType,
    employment_type: job.employmentType,
    seniority: job.seniority,
    canonical_url: job.canonicalUrl,
    source_updated_at: job.sourceUpdatedAt,
    posted_at: job.postedAt,
    expires_at: job.expiresAt,
    status: job.status,
    content_fingerprint: job.contentFingerprint,
    cross_posting_key: job.crossPostingKey,
    last_seen_at: seenAt,
  };
  const { data: savedPosting, error: postingError } = await admin
    .from("job_postings")
    .upsert(posting, { onConflict: "source_id,external_job_id" })
    .select("id")
    .single();
  if (postingError || !savedPosting) throw new Error("Could not save normalized job data");

  const { error: deleteSkillsError } = await admin
    .from("job_skills")
    .delete()
    .eq("job_posting_id", savedPosting.id);
  if (deleteSkillsError) throw new Error("Could not refresh job skills");

  if (job.skills.length > 0) {
    const { error: skillsError } = await admin.from("job_skills").insert(
      job.skills.map((skill) => ({
        job_posting_id: savedPosting.id,
        display_skill: skill.displaySkill,
        normalized_skill: skill.normalizedSkill,
        source: "provider" as const,
      })),
    );
    if (skillsError) throw new Error("Could not save normalized job skills");
  }

  const { error: payloadError } = await admin.rpc("upsert_job_posting_payload", {
    p_job_posting_id: savedPosting.id,
    p_source_id: source.id,
    p_payload: job.rawPayload,
    p_content_fingerprint: job.contentFingerprint,
  });
  if (payloadError) throw new Error("Could not save the private provider payload");

  await enqueueJobEmbedding(admin, {
    id: savedPosting.id,
    content_fingerprint: job.contentFingerprint,
  });
}

async function updateSource(
  admin: AdminClient,
  sourceId: string,
  values: TablesUpdate<"job_sources">,
) {
  const { error } = await admin.from("job_sources").update(values).eq("id", sourceId);
  if (error) throw new Error("Could not update job source status");
}

async function updateRun(
  admin: AdminClient,
  runId: string,
  values: TablesUpdate<"ingestion_runs">,
) {
  const { error } = await admin.from("ingestion_runs").update(values).eq("id", runId);
  if (error) throw new Error("Could not update ingestion run");
}

export async function ingestJobSource(sourceId: string, options: IngestionOptions = {}) {
  const admin = createAdminSupabaseClient();
  const now = options.now ?? (() => new Date());
  const { data: sourceRow, error: sourceError } = await admin
    .from("job_sources")
    .select("*")
    .eq("id", sourceId)
    .maybeSingle();
  if (sourceError || !sourceRow) {
    throw new JobSourceError("source_not_found", "The requested job source was not found.");
  }
  const source = asSource(sourceRow);
  if (source.status !== "active") {
    throw new JobSourceError("source_paused", "This job source is not active.");
  }

  const startedAt = now().toISOString();
  const { data: run, error: runError } = await admin
    .from("ingestion_runs")
    .insert({ source_id: source.id, started_at: startedAt })
    .select("id")
    .single();
  if (runError || !run) throw new Error("Could not create ingestion run");

  await updateSource(admin, source.id, { last_attempted_at: startedAt });

  const adapter = getJobSourceAdapter(source.provider);
  const maxPages = readPositiveInteger(
    options.maxPages ?? source.providerConfig.maxPages ?? process.env.JOB_INGESTION_MAX_PAGES,
    DEFAULT_MAX_PAGES,
    10,
  );
  const pageSize = readPositiveInteger(
    options.pageSize ?? defaultPageSize(source),
    DEFAULT_PAGE_SIZE,
    100,
  );
  let page = 1;
  let pagesFetched = 0;
  let recordsSeen = 0;
  let recordsUpserted = 0;
  let recordsFailed = 0;
  let rateLimitCount = 0;
  let retryCount = 0;
  let complete = false;
  let errorCode: string | null = null;
  let errorMessage: string | null = null;

  try {
    while (page <= maxPages) {
      const result = await adapter.fetchPage(source, {
        page,
        pageSize,
        signal: options.signal,
        onRetry: () => {
          retryCount = Math.min(5, retryCount + 1);
        },
      });
      pagesFetched += 1;
      recordsSeen += result.items.length;
      for (const item of result.items) {
        try {
          const normalized = adapter.normalize(item, source);
          await writeJob(admin, source, normalized, now().toISOString());
          recordsUpserted += 1;
        } catch (error) {
          recordsFailed += 1;
          if (error instanceof JobSourceError && error.code === "rate_limited") {
            rateLimitCount += 1;
          }
        }
      }
      if (result.complete || result.nextPage === null) {
        complete = true;
        break;
      }
      page = result.nextPage;
    }

    const finishedAt = now().toISOString();
    const runStatus = complete && recordsFailed === 0 ? "succeeded" : "partial";
    if (complete && recordsFailed === 0) {
      const { error: expireError } = await admin
        .from("job_postings")
        .update({ status: "expired", expires_at: finishedAt })
        .eq("source_id", source.id)
        .eq("status", "active")
        .lt("last_seen_at", startedAt);
      if (expireError) throw new Error("Could not expire stale job postings");
    }
    await updateRun(admin, run.id, {
      status: runStatus,
      pages_fetched: pagesFetched,
      records_seen: recordsSeen,
      records_upserted: recordsUpserted,
      records_failed: recordsFailed,
      retry_count: retryCount,
      rate_limit_count: rateLimitCount,
      is_complete: complete,
      completed_at: finishedAt,
      error_code: recordsFailed > 0 ? "invalid_records" : null,
      error_message: recordsFailed > 0 ? "Some provider records could not be normalized." : null,
    });
    await updateSource(admin, source.id, {
      status: "active",
      last_succeeded_at: complete ? finishedAt : sourceRow.last_succeeded_at,
      last_error_code: recordsFailed > 0 ? "invalid_records" : null,
      last_error_message:
        recordsFailed > 0 ? "Some provider records could not be normalized." : null,
    });

    return {
      sourceId: source.id,
      sourceSlug: source.slug,
      provider: source.provider,
      runId: run.id,
      status: runStatus,
      pagesFetched,
      recordsSeen,
      recordsUpserted,
      recordsFailed,
      isComplete: complete,
      errorCode: recordsFailed > 0 ? "invalid_records" : null,
    } satisfies IngestionSummary;
  } catch (error) {
    const failure =
      error instanceof JobSourceError
        ? error
        : new JobSourceError("ingestion_failed", "The job source could not be ingested.", {
            retryable: true,
          });
    errorCode = failure.code;
    errorMessage = failure.message;
    rateLimitCount += failure.rateLimited ? 1 : 0;
    const finishedAt = now().toISOString();
    await updateRun(admin, run.id, {
      status: pagesFetched > 0 ? "partial" : "failed",
      pages_fetched: pagesFetched,
      records_seen: recordsSeen,
      records_upserted: recordsUpserted,
      records_failed: recordsFailed,
      retry_count: retryCount,
      rate_limit_count: rateLimitCount,
      is_complete: false,
      completed_at: finishedAt,
      error_code: errorCode,
      error_message: errorMessage,
    });
    await updateSource(admin, source.id, {
      status: pagesFetched > 0 ? "active" : "error",
      last_error_code: errorCode,
      last_error_message: errorMessage,
    });
    return {
      sourceId: source.id,
      sourceSlug: source.slug,
      provider: source.provider,
      runId: run.id,
      status: pagesFetched > 0 ? "partial" : "failed",
      pagesFetched,
      recordsSeen,
      recordsUpserted,
      recordsFailed,
      isComplete: false,
      errorCode,
    } satisfies IngestionSummary;
  }
}

export async function ingestActiveJobSources(
  options: IngestionOptions & { maxSources?: number } = {},
) {
  const admin = createAdminSupabaseClient();
  const maxSources = readPositiveInteger(
    options.maxSources ?? process.env.JOB_INGESTION_MAX_SOURCES,
    3,
    10,
  );
  const { data: sources, error } = await admin
    .from("job_sources")
    .select("id")
    .eq("status", "active")
    .order("last_succeeded_at", { ascending: true, nullsFirst: true })
    .limit(maxSources);
  if (error) throw new Error("Could not load active job sources");

  const results: IngestionSummary[] = [];
  for (const source of sources ?? []) {
    try {
      results.push(await ingestJobSource(source.id, options));
    } catch (error) {
      results.push({
        sourceId: source.id,
        sourceSlug: "unknown",
        provider: "unknown",
        runId: "",
        status: "failed",
        pagesFetched: 0,
        recordsSeen: 0,
        recordsUpserted: 0,
        recordsFailed: 0,
        isComplete: false,
        errorCode: error instanceof JobSourceError ? error.code : "ingestion_failed",
      });
    }
  }
  return results;
}
