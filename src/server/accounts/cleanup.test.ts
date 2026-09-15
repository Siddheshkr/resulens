import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { requestAccountDeletion } from "@/server/accounts/cleanup";

vi.mock("server-only", () => ({}));

function createDeletionLookup(data: Record<string, unknown> | null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { admin: { from } as unknown as SupabaseClient<Database>, from };
}

describe("requestAccountDeletion", () => {
  it("does not reset a fresh cleanup claim when Clerk retries a deletion signal", async () => {
    const { admin, from } = createDeletionLookup({
      status: "processing",
      source: "application",
      locked_at: new Date(Date.now() - 60_000).toISOString(),
    });

    await expect(requestAccountDeletion("user_synthetic", "clerk_webhook", admin)).resolves.toEqual(
      { status: "pending" },
    );
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("account_deletion_jobs");
  });

  it("treats a completed cleanup as idempotent", async () => {
    const { admin, from } = createDeletionLookup({
      status: "complete",
      source: "application",
      locked_at: null,
    });

    await expect(requestAccountDeletion("user_synthetic", "clerk_webhook", admin)).resolves.toEqual(
      { status: "complete" },
    );
    expect(from).toHaveBeenCalledTimes(1);
  });
});
