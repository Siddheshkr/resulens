const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "cookies",
  "email",
  "filename",
  "name",
  "phone",
  "profile",
  "prompt",
  "request_body",
  "resume",
  "resume_id",
  "signed_url",
  "storage_path",
  "text",
  "token",
  "user_id",
]);

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "[Filtered]";
  }
}

export function scrubSensitiveData(value: unknown, key = ""): unknown {
  const normalizedKey = key.toLowerCase();
  if (SENSITIVE_KEYS.has(normalizedKey)) return "[Filtered]";
  if (typeof value === "string" && (normalizedKey === "url" || normalizedKey.endsWith("_url"))) {
    return safeUrl(value);
  }
  if (Array.isArray(value)) return value.map((item) => scrubSensitiveData(item));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        scrubSensitiveData(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

export function scrubSentryEvent<T>(event: T): T {
  return scrubSensitiveData(event) as T;
}
