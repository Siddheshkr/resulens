import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthenticationRequiredError, requireUser } from "@/lib/auth/require-user";

import { GET } from "@/app/api/private/route";

vi.mock("@/lib/auth/require-user", () => ({
  AuthenticationRequiredError: class AuthenticationRequiredError extends Error {
    constructor() {
      super("Authentication is required");
      this.name = "AuthenticationRequiredError";
    }
  },
  requireUser: vi.fn(),
}));

describe("GET /api/private", () => {
  beforeEach(() => {
    vi.mocked(requireUser).mockReset();
  });

  it("returns an authentication error for an anonymous request", async () => {
    vi.mocked(requireUser).mockRejectedValue(new AuthenticationRequiredError());

    const response = await GET();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Authentication required" });
  });

  it("returns success for an authenticated request", async () => {
    vi.mocked(requireUser).mockResolvedValue({ userId: "user_test_123" });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });
});
