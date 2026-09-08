import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({})),
}));

describe("createServerSupabaseClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.mocked(createClient).mockClear();
  });

  it("passes the current Clerk token through Supabase accessToken", async () => {
    const getToken = vi.fn().mockResolvedValue("clerk-session-token");
    vi.mocked(auth).mockResolvedValue({ getToken } as unknown as Awaited<ReturnType<typeof auth>>);

    await createServerSupabaseClient();

    const options = vi.mocked(createClient).mock.calls[0]?.[2];
    expect(options).toBeDefined();
    await expect(options?.accessToken?.()).resolves.toBe("clerk-session-token");
    expect(getToken).toHaveBeenCalledOnce();
  });
});
