export const MATCH_POLL_INTERVAL_MS = 2_500;
export const MATCH_POLL_ATTEMPTS = 20;
const MATCH_RESUME_EVERY_ATTEMPTS = 4;

export function shouldResumePendingMatch(attempt: number) {
  return (
    attempt > 0 && attempt <= MATCH_POLL_ATTEMPTS && attempt % MATCH_RESUME_EVERY_ATTEMPTS === 0
  );
}
