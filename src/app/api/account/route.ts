import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import { deleteAccountSchema, updateAccountSettingsSchema } from "@/lib/accounts/requests";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requestAccountDeletion } from "@/server/accounts/cleanup";
import { ensureUserProfile } from "@/server/accounts/profile";
import { rawFileDeleteAfter } from "@/server/resumes/retention";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Authentication required" }, { status: 401 });
}

export async function GET() {
  try {
    const { userId } = await requireUser();
    const supabase = await createServerSupabaseClient();
    const profile = await ensureUserProfile(supabase, userId);
    return Response.json({ settings: profile });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    throw error;
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await requireUser();
    const body = updateAccountSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!body.success)
      return Response.json({ error: "Invalid account settings." }, { status: 400 });
    const updates = {
      ...(body.data.rawFileRetentionPolicy
        ? { raw_file_retention_policy: body.data.rawFileRetentionPolicy }
        : {}),
      ...(body.data.onboardingComplete !== undefined
        ? {
            onboarding_completed_at: body.data.onboardingComplete ? new Date().toISOString() : null,
          }
        : {}),
    };
    const supabase = await createServerSupabaseClient();
    await ensureUserProfile(supabase, userId);
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", userId)
      .eq("deletion_status", "active")
      .select("raw_file_retention_policy,onboarding_completed_at,deletion_status")
      .single();
    if (error) throw new Error("Could not save account settings");
    if (body.data.rawFileRetentionPolicy) {
      const { error: retentionError } = await supabase
        .from("resumes")
        .update({ raw_file_delete_after: rawFileDeleteAfter(body.data.rawFileRetentionPolicy) })
        .eq("user_id", userId)
        .eq("status", "approved")
        .is("raw_file_deleted_at", null);
      if (retentionError) throw new Error("Could not apply the retention preference");
    }
    return Response.json({ settings: data });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    throw error;
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await requireUser();
    const body = deleteAccountSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return Response.json({ error: "Type DELETE to confirm." }, { status: 400 });
    const rate = checkRateLimit(`account-delete:${userId}`, 2, 60 * 60_000);
    if (!rate.allowed)
      return Response.json(
        { error: "A deletion request is already being handled." },
        { status: 429 },
      );
    const result = await requestAccountDeletion(userId, "application");
    return Response.json(result, { status: result.status === "complete" ? 200 : 202 });
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) return unauthorized();
    throw error;
  }
}
