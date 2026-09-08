import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@clerk/nextjs/server";

import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

describe("requireUser", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_resulens");
    vi.mocked(auth).mockReset();
  });

  it("returns the stable Clerk subject for an authenticated request", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user_test_123" } as Awaited<
      ReturnType<typeof auth>
    >);

    await expect(requireUser()).resolves.toEqual({ userId: "user_test_123" });
  });

  it("rejects an unauthenticated request", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    await expect(requireUser()).rejects.toBeInstanceOf(AuthenticationRequiredError);
  });
});
