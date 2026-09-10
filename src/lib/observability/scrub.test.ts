import { describe, expect, it } from "vitest";

import { scrubSensitiveData } from "@/lib/observability/scrub";

describe("scrubSensitiveData", () => {
  it("removes applicant content and request credentials recursively", () => {
    expect(
      scrubSensitiveData({
        user_id: "user_secret",
        request: {
          cookies: "session=secret",
          url: "https://resulens.example/dashboard?resume=secret#private",
        },
        extra: { profile: { name: "Applicant" } },
        safeCount: 3,
      }),
    ).toEqual({
      user_id: "[Filtered]",
      request: {
        cookies: "[Filtered]",
        url: "https://resulens.example/dashboard",
      },
      extra: { profile: "[Filtered]" },
      safeCount: 3,
    });
  });
});
