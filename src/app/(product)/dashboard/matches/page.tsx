import { redirect } from "next/navigation";

import { MatchFeed } from "@/components/match-feed";
import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCandidatePreferences, getLatestMatchRun } from "@/server/matching/service";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (error) {
    if (error instanceof AuthenticationRequiredError)
      redirect("/sign-in?redirect_url=/dashboard/matches");
    throw error;
  }

  const supabase = await createServerSupabaseClient();
  const [{ data: resumes, error: resumesError }, preferences, initialRun] = await Promise.all([
    supabase
      .from("resumes")
      .select("id,original_filename,status,approved_profile_version")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    getCandidatePreferences(userId),
    getLatestMatchRun(userId),
  ]);
  if (resumesError) throw new Error("Could not load approved resumes");

  return (
    <MatchFeed
      resumes={resumes ?? []}
      initialPreferences={{
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
      }}
      initialRun={initialRun}
    />
  );
}
