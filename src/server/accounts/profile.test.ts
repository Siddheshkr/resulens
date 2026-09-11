import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";

vi.mock("server-only", () => ({}));

import { ensureUserProfile } from "@/server/accounts/profile";

describe("ensureUserProfile", () => {
  it("creates missing profiles without updating protected lifecycle columns", async () => {
    const profile = {
      user_id: "user_synthetic",
      onboarding_completed_at: null,
      raw_file_retention_policy: "delete_after_approval",
      deletion_status: "active",
      deletion_requested_at: null,
    };
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({ data: profile, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const client = {
      from: vi.fn().mockReturnValue({ upsert, select }),
    } as unknown as SupabaseClient<Database>;

    await expect(ensureUserProfile(client, profile.user_id)).resolves.toEqual(profile);
    expect(upsert).toHaveBeenCalledWith(
      { user_id: profile.user_id },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  });
});
