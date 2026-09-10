# Operations and recovery runbook

## Scheduled maintenance

Invoke `maintain-production` every five minutes. It calls the authenticated internal operations endpoint, retries incomplete account cleanup, deletes expired source PDFs, and recovers processing locks older than ten minutes. The endpoint returns counts only and never applicant identifiers or content.

## Alert signals

Create Sentry alerts and an operations dashboard for:

- any `account_cleanup_failed` or non-zero incomplete deletion count for 15 minutes;
- stalled resume work older than ten minutes;
- failed embedding jobs above the normal baseline;
- an active job source with no successful refresh for 12 hours;
- repeated Clerk webhook verification or account session-revocation errors;
- OpenAI spend or token usage above the environment budget.

Sentry uses `sendDefaultPii: false` plus a repository-owned recursive scrubber. Never attach request bodies, Clerk subjects, filenames, resume IDs, profile JSON, prompts, signed URLs, tokens, cookies, or authorization headers to an event.

## Account deletion recovery

Deletion order is: mark the account and block writes, revoke Clerk sessions, remove Storage objects through the Storage API, delete the profile cascade, delete the Clerk user, then mark the durable cleanup job complete. The cleanup job is not a child of `profiles`, so a later maintenance run can finish a partial deletion.

If cleanup is stuck, inspect aggregate status first through `GET /api/internal/operations` with the operations worker secret. Investigate the provider outage without copying applicant identifiers into tickets or chat. Re-run scheduled maintenance after recovery; do not delete rows directly unless the Storage stage is already complete.

## Database recovery and rollback

Before a production migration, confirm the latest Supabase backup/PITR point and record the migration version. Migrations are forward-only. If an application release fails, roll back the Vercel deployment while leaving additive database structures in place. Correct schema faults with a new migration. Restoring a database does not restore Storage objects.

For a service incident: disable new upload/matching traffic, keep deletion maintenance enabled, roll back the application, verify migration compatibility, and run a synthetic smoke test before reopening processing.
