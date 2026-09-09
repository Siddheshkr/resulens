import { createHash } from "node:crypto";

const BLOCK_TAG_PATTERN = /<\/?(?:script|style|iframe|object|embed|form|noscript|svg)[^>]*>/gi;
const DANGEROUS_BLOCK_PATTERN =
  /<(?:script|style|iframe|object|embed|form|noscript|svg)\b[^>]*>[\s\S]*?<\/(?:script|style|iframe|object|embed|form|noscript|svg)>/gi;
const TAG_PATTERN = /<[^>]*>/g;
const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lt: "<",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
  trade: "™",
};

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return ENTITY_MAP[lower] ?? match;
  });
}

/** Convert provider HTML into bounded plain text before it reaches storage/UI. */
export function sanitizeProviderDescription(value: string, maxLength = 250_000) {
  return decodeEntities(value)
    .replace(DANGEROUS_BLOCK_PATTERN, " ")
    .replace(BLOCK_TAG_PATTERN, " ")
    .replace(TAG_PATTERN, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeCompanyName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function parseIsoDate(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function parseEpochDate(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  const timestamp = numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  return new Date(timestamp).toISOString();
}

export function fingerprintJob(input: {
  title: string;
  description: string;
  locationText: string | null;
  companyName: string | null;
  canonicalUrl: string;
}) {
  const normalized = [
    input.title,
    input.description,
    input.locationText ?? "",
    input.companyName ?? "",
    input.canonicalUrl,
  ]
    .map((value) => value.trim().toLowerCase())
    .join("\n");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function inferWorkplaceType(value: string | null | undefined) {
  const normalized = value?.toLowerCase() ?? "";
  if (/\bhybrid\b/.test(normalized)) return "hybrid" as const;
  if (/\b(remote|work from home|distributed)\b/.test(normalized)) return "remote" as const;
  return "unknown" as const;
}
