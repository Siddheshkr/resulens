import { redirect } from "next/navigation";

import { AccountSettingsForm } from "@/components/account-settings-form";
import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";
import type { RawFileRetentionPolicy } from "@/lib/accounts/requests";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (error) {
    if (error instanceof AuthenticationRequiredError)
      redirect("/sign-in?redirect_url=/dashboard/settings");
    throw error;
  }
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("raw_file_retention_policy")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error("Could not load privacy settings");
  const policy: RawFileRetentionPolicy =
    data.raw_file_retention_policy === "retain_30_days"
      ? "retain_30_days"
      : "delete_after_approval";

  return (
    <div className="product-page settings-page">
      <div className="page-intro">
        <div>
          <p className="signal-label">
            <span className="signal-dot" aria-hidden="true" />
            Account controls
          </p>
          <h1>Privacy with an off switch.</h1>
          <p>
            Choose how long the source PDF lasts and remove your account without leaving derived
            data behind.
          </p>
        </div>
      </div>
      <AccountSettingsForm initialPolicy={policy} />
    </div>
  );
}
