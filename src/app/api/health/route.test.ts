import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  it("returns a non-sensitive service status", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok", service: "resulens", version: "0.1.0" });
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });
});
