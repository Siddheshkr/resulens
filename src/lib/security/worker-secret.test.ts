import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hasValidWorkerSecret } from "@/lib/security/worker-secret";

describe("worker secret verification", () => {
  it("accepts only the exact configured value", () => {
    expect(hasValidWorkerSecret("synthetic-secret", "synthetic-secret")).toBe(true);
    expect(hasValidWorkerSecret("synthetic-secret", "different-secret")).toBe(false);
    expect(hasValidWorkerSecret("synthetic-secret", "short")).toBe(false);
  });

  it("rejects missing values", () => {
    expect(hasValidWorkerSecret(undefined, "synthetic-secret")).toBe(false);
    expect(hasValidWorkerSecret("synthetic-secret", null)).toBe(false);
  });
});
