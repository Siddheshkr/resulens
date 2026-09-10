export const MAX_EMBEDDING_ATTEMPTS = 3;

export function nextEmbeddingAttempt(currentAttempt: number) {
  const normalized = Number.isFinite(currentAttempt) ? Math.max(0, Math.floor(currentAttempt)) : 0;
  const attemptCount = Math.min(MAX_EMBEDDING_ATTEMPTS, normalized + 1);
  return { attemptCount, terminal: attemptCount >= MAX_EMBEDDING_ATTEMPTS };
}
