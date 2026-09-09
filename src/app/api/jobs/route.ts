import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { jobListQuerySchema } from "@/lib/jobs/requests";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function GET(request: Request) {
  try {
    await requireUser();
    const url = new URL(request.url);
    const parsed = jobListQuerySchema.safeParse({
      search: url.searchParams.get("search") ?? undefined,
      country: url.searchParams.get("country") ?? undefined,
      workplace: url.searchParams.get("workplace") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
    });
    if (!parsed.success) {
      return Response.json(
        { error: "Use a valid search, country, workplace, or page." },
        { status: 400 },
      );
    }

    const { search, country, workplace, page } = parsed.data;
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("job_postings")
      .select(
        "id,title,description,location_text,country_code,workplace_type,employment_type,seniority,canonical_url,posted_at,source_updated_at,companies(display_name),job_sources(provider,display_name)",
      )
      .eq("status", "active");
    if (search) {
      query = query.textSearch("search_document", search, { type: "websearch", config: "simple" });
    }
    if (country) query = query.eq("country_code", country.toUpperCase());
    if (workplace) query = query.eq("workplace_type", workplace);

    const pageSize = 20;
    const from = (page - 1) * pageSize;
    const { data, error } = await query
      .order("posted_at", { ascending: false, nullsFirst: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Could not load jobs");

    const jobs = (data ?? []).map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description.slice(0, 360),
      locationText: job.location_text,
      countryCode: job.country_code,
      workplaceType: job.workplace_type,
      employmentType: job.employment_type,
      seniority: job.seniority,
      canonicalUrl: job.canonical_url,
      postedAt: job.posted_at,
      sourceUpdatedAt: job.source_updated_at,
      sourceProvider: Array.isArray(job.job_sources)
        ? (job.job_sources[0]?.provider ?? null)
        : (job.job_sources?.provider ?? null),
      sourceName: Array.isArray(job.job_sources)
        ? (job.job_sources[0]?.display_name ?? null)
        : (job.job_sources?.display_name ?? null),
      companyName: Array.isArray(job.companies)
        ? (job.companies[0]?.display_name ?? null)
        : (job.companies?.display_name ?? null),
    }));

    return Response.json({ jobs, page, pageSize });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    throw error;
  }
}
