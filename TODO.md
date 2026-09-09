# ResuLens Work Tracker

Last reviewed: 2026-09-09

This file is the lightweight, repository-level source of truth for planned and completed work. Product and architecture decisions belong in `context.md`; contributor rules belong in `AGENTS.md`; runtime logs belong in the relevant observability system.

## How to Maintain This File

- Keep tasks small enough to have one verifiable outcome.
- Use GitHub issues once collaboration or backlog volume makes this file difficult to review.
- Move a task between sections instead of duplicating it.
- Mark a task complete only after its relevant checks pass.
- Add the completion date and short verification evidence to completed work.
- Link an issue, pull request, commit, migration, or test when one exists.
- Record a blocker with the required decision or external dependency.
- Do not place secrets, personal data, resume content, API responses, or raw logs here.
- Update `Last reviewed` whenever this file is materially reorganized.

Task format:

```text
- [ ] Outcome-oriented task description
  - Owner: unassigned
  - Depends on: none
  - Verify: concrete command or acceptance check
```

Completed task format:

```text
- [x] Outcome that was completed — YYYY-MM-DD
  - Evidence: tests, build, migration, commit, or concise manual verification
```

## Now

- [ ] Run the Phase 1 GitHub Actions workflow from a clean checkout
  - Owner: unassigned
  - Depends on: review and push of the Phase 1 changes
  - Verify: the `quality` and `database` jobs pass with repository-managed configuration; local quality and browser checks are green, but the hosted workflow still requires a push.

- [ ] Run a real Clerk email/Google OAuth and webhook delivery smoke test
  - Owner: unassigned
  - Depends on: a Clerk test account, enabled providers, and the deployed webhook URL
  - Verify: sign-in, sign-up, sign-out, and `user.deleted` delivery complete against the configured Clerk instance without exposing secrets

- [ ] Apply the Phase 2 Supabase migration to local/staging environments
  - Owner: unassigned
  - Depends on: Docker Desktop or Podman for local Supabase, plus each environment's migration history
  - Verify: `supabase db push --linked` or the environment's migration workflow applies `20260909102800_create_resume_processing_foundation.sql`, generated types are refreshed, and Supabase security/performance advisors remain clean

- [ ] Configure and smoke-test the Phase 2 worker path
  - Owner: unassigned
  - Depends on: the Phase 2 migration, OpenAI server key, worker secret, deployed app URL, and a synthetic PDF
  - Verify: signed upload, completion, bounded worker processing, profile review, approval, retry, refresh, and deletion complete without raw resume content in logs

- [ ] Configure and smoke-test the Phase 3 job ingestion worker
  - Owner: unassigned
  - Depends on: provider credentials, one or more curated board/site rows, `JOB_INGESTION_SECRET`, and a deployed app URL
  - Verify: a synthetic or permitted provider run is idempotent, partial provider failure is isolated, stale jobs expire only after a complete run, and `/dashboard/jobs` shows normalized listings without raw payloads

## Next

- [ ] Replace the process-local upload/retry limiter with distributed rate limiting before public beta
  - Owner: unassigned
  - Depends on: Upstash Redis/Ratelimit deployment decision
  - Verify: limits hold across multiple app instances without logging identifiers or resume content

- [ ] Add representative extraction evaluation fixtures and lock the production model snapshot
  - Owner: unassigned
  - Depends on: synthetic text/scanned resume corpus and provider budget
  - Verify: schema validity, evidence grounding, confidence calibration, latency, and token-cost baseline are recorded

- [ ] Implement job and resume embedding workflows
  - Owner: unassigned
  - Depends on: normalized jobs and approved resume profiles
  - Verify: queued embeddings retry safely and remain synchronized after content changes

- [ ] Implement hard filters, hybrid retrieval, and deterministic scoring
  - Owner: unassigned
  - Depends on: embeddings and candidate preferences
  - Verify: ranking unit tests and representative precision-at-10/nDCG evaluation pass the agreed baseline

## Later

- [ ] Build the match feed and job detail experience
- [ ] Add evidence-grounded match explanations
- [ ] Add save, dismiss, applied, and feedback workflows
- [ ] Add public-endpoint rate limiting
- [ ] Add Sentry with PII-safe error and performance reporting
- [ ] Add automated raw-resume retention and complete account deletion
- [ ] Complete mobile, accessibility, failure-state, and no-sensitive-log testing
- [ ] Create staging and production deployment environments
- [ ] Define launch readiness, support, and incident procedures

## Blocked

- [ ] Run local Supabase pgTAP tests
  - Blocked since: 2026-09-08
  - Reason: verified again on 2026-09-09, `npm run test:db` cannot connect to the local Postgres service at `127.0.0.1:54322`; Docker Desktop or Podman is not installed/running in this environment.
  - Needs: Docker Desktop or Podman, then `supabase start` and `npm run test:db`

When adding a blocker, use this form:

```text
- [ ] Blocked outcome
  - Blocked since: YYYY-MM-DD
  - Reason: concise factual blocker
  - Needs: decision, credential, provider response, or external state change
```

## Completed

- [x] Define the initial ResuLens product, workflow, stack, architecture, security boundaries, and delivery plan — 2026-09-08
  - Evidence: `context.md`

- [x] Add repository-wide implementation and verification guidance — 2026-09-08
  - Evidence: `AGENTS.md`

- [x] Add the resume-to-job Mermaid workflow to the architecture context — 2026-09-08
  - Evidence: `context.md` under Core User Workflow

- [x] Scaffold the pinned Phase 1 application and toolchain — 2026-09-08
  - Evidence: `.nvmrc`, `package.json`, `package-lock.json`, Next.js App Router routes, strict TypeScript, Tailwind 4, Vitest, Playwright, ESLint, Prettier, and `.github/workflows/ci.yml`
  - Verification: current local re-run on Node 24: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (10 passed), `npm run build`, and `npm run test:e2e` (6 passed)

- [x] Configure Clerk authentication and the protected application shell — 2026-09-08
  - Evidence: `src/proxy.ts`, `requireUser()`, Clerk sign-in/sign-up routes, signed-in navigation, `/dashboard`, and verified Clerk webhook handler
  - Verification: `clerk doctor --json` passed; public landing, health, and unauthenticated dashboard redirect Playwright checks passed

- [x] Create the ResuLens Supabase project, profile schema, generated types, and RLS foundation — 2026-09-08
  - Evidence: Supabase project `resulens`, migrations in `supabase/migrations/`, pgTAP fixture in `supabase/tests/`, and generated `src/lib/supabase/database.types.ts`
  - Verification: hosted migrations applied; security/performance advisors returned no lints; hosted `profiles_rls.test.sql` passes all 8 assertions through the linked SQL runner with synthetic rows rolled back; transactional checks confirmed same-user visibility, cross-user denial, anonymous denial, and ownership-reassignment denial

- [x] Define the Clerk-to-Supabase environment and local provider contract — 2026-09-08
  - Evidence: `.env.example`, server/browser Supabase clients using Clerk `accessToken`, `supabase/config.toml` third-party provider placeholder, and README setup instructions
  - Verification: server Supabase unit test confirms the Clerk token callback; no credentials are tracked

- [x] Activate the hosted Supabase third-party Clerk connection — 2026-09-08
  - Evidence: Supabase Dashboard for project `resulens` shows Clerk enabled for the development domain `grown-bass-4061.clerk.accounts.dev`
  - Verification: the connection appears as `ENABLED` under Authentication → Sign In / Providers → Third-Party Auth

- [x] Activate Clerk's Supabase session integration for the development instance — 2026-09-09
  - Evidence: Clerk Dashboard → Connect Clerk with Supabase reports the ResuLens development integration as `Enabled` and Supabase reports the Clerk provider as `ENABLED`
  - Verification: Clerk now adds the Supabase-compatible role claim to new session tokens; existing browser sessions must refresh or sign in again

- [x] Add Phase 1 documentation and repository operating guidance — 2026-09-08
  - Evidence: updated `context.md`, `AGENTS.md`, `README.md`, and this status tracker

- [x] Fix Clerk auth form visibility and establish the dark-only product shell — 2026-09-09
  - Evidence: dedicated `/sign-in` and `/sign-up` route links, Clerk-hosted account UI with namespaced appearance classes, scoped dark form styling, skip link, dark dashboard, responsive auth layout, explicit Clerk failure/retry state, and a bounded loading timeout
  - Verification: `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test` (10 passed), `npm run build`, and `npm run test:e2e` (6 passed); the local sign-in and sign-up forms render with Google/email options

- [x] Make local Clerk auth resilient to public-route middleware and host binding issues — 2026-09-09
  - Evidence: public routes bypass the server-side Clerk middleware round trip; protected dashboard/private API paths remain protected; anonymous private API requests receive an internal signed-out auth context without a Clerk handshake; `npm run dev` uses the stable webpack path and binds IPv4 loopback, while `npm run dev:lan` is available for LAN testing
  - Verification: `/api/health` responds, `/api/private` returns 401, `/sign-in` renders the Clerk card, and `/dashboard` still redirects unauthenticated users in Playwright

- [x] Make Clerk webhook cleanup retryable and private API authorization explicit — 2026-09-09
  - Evidence: duplicate webhook deliveries with an unfinished `processed_at` record retry profile deletion; `/api/private` re-checks `requireUser()` and returns a safe 401 response
  - Verification: webhook retry/idempotency unit tests and private API unit test pass; full Vitest suite reports 10 passing tests

- [x] Remove the vulnerable bundled Clerk UI dependency and verify the production dependency audit — 2026-09-09
  - Evidence: `@clerk/ui` was removed; Clerk-hosted UI is loaded by `ClerkProvider`, and custom appearance classes no longer depend on Clerk's internal DOM class names
  - Verification: `npm audit --omit=dev --audit-level=high` reports `found 0 vulnerabilities`; `npm ci` remains lockfile-backed

- [x] Implement the Phase 2 resume intake, processing, and profile-review source foundation — 2026-09-09
  - Evidence: private signed-upload API, consent/quota/rate checks, `resumes`/`resume_profiles`/`resume_processing_jobs` and `resume_processing` Queue migration, Storage policies, `unpdf` validation and extraction, OpenAI Responses Structured Outputs contract, bounded worker Edge Function, versioned profile edit/approval routes, retry/status polling, deletion cleanup, and dark dashboard review screens
  - Verification: `npm run lint`, `npm run typecheck`, `npm test` (17 passing tests), `npm run build`, and `npm run test:e2e` (7 passing tests); synthetic PDF text/weak-extraction/malformed-PDF and rate-limit tests pass. Hosted migration `20260909102800_create_resume_processing_foundation.sql` is applied to project `resulens`; catalog checks confirm the resume tables, `pgmq`, private Storage bucket, and migration history. Hosted `resumes_rls.test.sql` passes all 11 assertions through the linked SQL runner with synthetic rows rolled back. Live OpenAI/worker smoke testing remains in Now.

- [x] Deploy the hosted Phase 2 schema and ownership indexes — 2026-09-09
  - Evidence: `20260909102800_create_resume_processing_foundation.sql` and `20260909120000_add_resume_ownership_indexes.sql` are applied to the linked `resulens` project.
  - Verification: `supabase db lint --linked` reports no schema errors; advisors report no unindexed foreign keys or security findings. Remaining unused-index notices are expected until real resume/worker traffic exists.

- [x] Verify hosted Phase 1 and Phase 2 RLS policies with Docker-free pgTAP — 2026-09-09
  - Evidence: `supabase/tests/profiles_rls.test.sql` (8 assertions) and `supabase/tests/resumes_rls.test.sql` (11 assertions) executed against the linked `resulens` project with `finish(true)`.
  - Verification: all assertions passed; synthetic profile, resume, and job rows were confirmed absent after each transaction. Local pgTAP remains a Docker-dependent check only.

- [x] Implement the Phase 3 normalized job schema and provider adapters — 2026-09-09
  - Evidence: `job_sources`, `companies`, `job_postings`, `job_skills`, `ingestion_runs`, private raw-payload storage, shared adapter contract, Adzuna/Greenhouse/Lever adapters, bounded retrying fetch, idempotent ingestion service, internal worker route, `ingest-jobs` Edge Function, authenticated `/dashboard/jobs` feed, and job RLS test coverage.
  - Verification: 21 Vitest tests pass, including HTML sanitization, provider validation, pagination, retry behavior, and safe normalization. Hosted migrations `20260909165339`, `20260909165456`, `20260909170206`, and `20260909170637` are applied; security advisors report no findings, and the remaining performance notices are expected unused-index INFO entries before ingestion traffic. Hosted RLS pgTAP verification also passes through the linked Supabase SQL runner with synthetic data rolled back; local pgTAP execution remains blocked by the unavailable local Postgres service.

- [x] Verify hosted Phase 3 RLS policies with Docker-free pgTAP — 2026-09-09
  - Evidence: `supabase/tests/jobs_rls.test.sql` executed against the linked `resulens` project after enabling the `pgtap` extension; `finish(true)` returned successfully for the 12 planned assertions.
  - Verification: synthetic source, company, job, skill, and private-payload rows were confirmed absent after the transaction, proving the test cleanup rollback.
