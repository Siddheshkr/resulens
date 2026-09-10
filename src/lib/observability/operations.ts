import "server-only";

import * as Sentry from "@sentry/nextjs";

type OperationalSnapshot = {
  failedResumes: number;
  stalledResumes: number;
  failedEmbeddings: number;
  staleSources: number;
  incompleteAccountDeletions: number;
  estimatedAiSpendMicrousd24h: number;
  aiSpendAlert: boolean;
};

export function reportOperationalSnapshot(snapshot: OperationalSnapshot) {
  const signals = [
    ["failed_resume_tasks", snapshot.failedResumes > 0, snapshot.failedResumes],
    ["stalled_resume_tasks", snapshot.stalledResumes > 0, snapshot.stalledResumes],
    ["failed_embedding_tasks", snapshot.failedEmbeddings > 0, snapshot.failedEmbeddings],
    ["stale_job_sources", snapshot.staleSources > 0, snapshot.staleSources],
    [
      "incomplete_account_deletions",
      snapshot.incompleteAccountDeletions > 0,
      snapshot.incompleteAccountDeletions,
    ],
    ["unusual_ai_spend", snapshot.aiSpendAlert, snapshot.estimatedAiSpendMicrousd24h],
  ] as const;

  for (const [signal, active, count] of signals) {
    if (!active) continue;
    Sentry.withScope((scope) => {
      scope.setTag("operational_signal", signal);
      scope.setExtra("aggregate_count", count);
      Sentry.captureMessage(`ResuLens operational signal: ${signal}`, "warning");
    });
  }
}
