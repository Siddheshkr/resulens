import { JobSourceError } from "@/server/job-sources/types";

const MAX_RESPONSE_BYTES = 2_000_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_ATTEMPTS = 3;

export type FetchJsonOptions = {
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  attempts?: number;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: () => void;
};

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}) {
  const fetchFn = options.fetchFn ?? fetch;
  const attempts = Math.max(1, Math.min(options.attempts ?? DEFAULT_ATTEMPTS, 3));
  const timeoutMs = Math.max(1_000, Math.min(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, 30_000));
  let lastError: JobSourceError | null = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", abortFromCaller, { once: true });

    try {
      const response = await fetchFn(url, {
        headers: { Accept: "application/json", "User-Agent": "ResuLens/0.1 job-ingestion" },
        signal: controller.signal,
      });
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) {
        throw new JobSourceError("response_too_large", "The provider response was too large.");
      }

      const body = new Uint8Array(await response.arrayBuffer());
      if (body.byteLength > MAX_RESPONSE_BYTES) {
        throw new JobSourceError("response_too_large", "The provider response was too large.");
      }

      if (!response.ok) {
        const rateLimited = response.status === 429;
        throw new JobSourceError(
          rateLimited ? "rate_limited" : `provider_http_${response.status}`,
          rateLimited
            ? "The provider rate limit was reached."
            : "The job provider returned an error.",
          { retryable: response.status >= 500 || rateLimited, rateLimited },
        );
      }

      try {
        return JSON.parse(new TextDecoder().decode(body)) as T;
      } catch {
        throw new JobSourceError("invalid_provider_json", "The provider returned invalid JSON.");
      }
    } catch (error) {
      const normalized =
        error instanceof JobSourceError
          ? error
          : error instanceof DOMException && error.name === "AbortError"
            ? new JobSourceError("provider_timeout", "The job provider timed out.", {
                retryable: true,
              })
            : new JobSourceError(
                "provider_network_error",
                "The job provider could not be reached.",
                {
                  retryable: true,
                },
              );
      lastError = normalized;
      if (!normalized.retryable || attempt === attempts) {
        throw normalized;
      }
      options.onRetry?.();
      await (options.sleep ?? wait)(normalized.rateLimited ? 1_000 : 250 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abortFromCaller);
    }
  }

  throw (
    lastError ?? new JobSourceError("provider_network_error", "The provider could not be reached.")
  );
}

export function readConfigString(config: Record<string, unknown>, key: string) {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readConfigNumber(config: Record<string, unknown>, key: string, fallback: number) {
  const value = config[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
