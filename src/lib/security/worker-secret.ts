import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function hasValidWorkerSecret(expected?: string, actual?: string | null) {
  if (!expected || !actual) return false;
  return timingSafeEqual(digest(expected), digest(actual));
}
