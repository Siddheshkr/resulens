export type EmbeddingFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

export function embeddingFailureMessage(code: string | null | undefined) {
  switch (code) {
    case "provider_unconfigured":
      return "AI matching is not configured for this environment.";
    case "provider_quota_exhausted":
      return "AI matching is unavailable because the configured provider has no available quota. Add API credits, then retry.";
    case "provider_unauthorized":
      return "AI matching could not authenticate with the configured provider.";
    case "provider_model_unavailable":
      return "AI matching is not available for the configured provider model.";
    case "provider_rate_limited":
      return "The AI matching provider is rate-limiting requests. We will retry shortly.";
    default:
      return "The matching signal could not be generated.";
  }
}

type ProviderErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  type?: unknown;
};

function asProviderError(error: unknown): ProviderErrorLike {
  return typeof error === "object" && error !== null ? (error as ProviderErrorLike) : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function classifyEmbeddingError(error: unknown): EmbeddingFailure {
  const providerError = asProviderError(error);
  const code = asString(providerError.code);
  const type = asString(providerError.type);
  const message = asString(providerError.message);
  const status = typeof providerError.status === "number" ? providerError.status : null;

  if (message.includes("OPENAI_API_KEY")) {
    return {
      code: "provider_unconfigured",
      message: embeddingFailureMessage("provider_unconfigured"),
      retryable: false,
    };
  }

  if (
    code === "credit_balance_exhausted" ||
    type === "insufficient_quota" ||
    /quota|credit balance|billing quota|no balance|run out of credits/i.test(message)
  ) {
    return {
      code: "provider_quota_exhausted",
      message: embeddingFailureMessage("provider_quota_exhausted"),
      retryable: false,
    };
  }

  if (code === "invalid_api_key" || status === 401) {
    return {
      code: "provider_unauthorized",
      message: embeddingFailureMessage("provider_unauthorized"),
      retryable: false,
    };
  }

  if (code === "model_not_found" || status === 403) {
    return {
      code: "provider_model_unavailable",
      message: embeddingFailureMessage("provider_model_unavailable"),
      retryable: false,
    };
  }

  if (code === "rate_limit_exceeded" || type === "rate_limit_error" || status === 429) {
    return {
      code: "provider_rate_limited",
      message: embeddingFailureMessage("provider_rate_limited"),
      retryable: true,
    };
  }

  return {
    code: "embedding_failed",
    message: embeddingFailureMessage("embedding_failed"),
    retryable: true,
  };
}
