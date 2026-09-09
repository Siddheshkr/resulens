import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { preferencesSchema } from "@/server/matching/requests";
import { getCandidatePreferences, saveCandidatePreferences } from "@/server/matching/service";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

function serialize(preferences: Awaited<ReturnType<typeof getCandidatePreferences>>) {
  return {
    revision: preferences.revision,
    countryCodes: preferences.country_codes,
    preferredLocations: preferences.preferred_locations,
    workplaceTypes: preferences.workplace_types,
    roleExclusions: preferences.role_exclusions,
    minimumExperienceYears: preferences.minimum_experience_years,
    maximumExperienceYears: preferences.maximum_experience_years,
    salaryMinimum: preferences.salary_minimum,
    salaryCurrency: preferences.salary_currency,
    workAuthorizationStatus: preferences.work_authorization_status,
  };
}

export async function GET() {
  try {
    const { userId } = await requireUser();
    return Response.json({ preferences: serialize(await getCandidatePreferences(userId)) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return Response.json({ error: "Could not load matching preferences." }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await requireUser();
    const body = preferencesSchema.partial().safeParse(await request.json().catch(() => null));
    if (!body.success) {
      return Response.json({ error: "Use valid matching preferences." }, { status: 400 });
    }
    const preferences = await saveCandidatePreferences(userId, body.data);
    return Response.json({ preferences: serialize(preferences) });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    return Response.json({ error: "Could not save matching preferences." }, { status: 503 });
  }
}
